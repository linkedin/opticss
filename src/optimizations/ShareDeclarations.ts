import * as postcss from "postcss";
import * as specificity from "specificity";
import * as propParser from "css-property-parser";
import { BSTree, MultiDictionary, Dictionary } from "typescript-collections";
import { MultiFileOptimization } from "./Optimization";
import { OptiCSSOptions, TemplateIntegrationOptions } from "../OpticssOptions";
import { OptimizationPass } from "../Optimizer";
import { TemplateAnalysis } from "../TemplateAnalysis";
import { TemplateTypes } from "../TemplateInfo";
import { ParsedCssFile } from "../CssFile";
import { walkRules, RuleScope } from "./util";
import { ParsedSelector } from "../parseSelector";
import { Element } from "../Selectable";
import { MergeDeclarations, Declaration } from "../actions/MergeDeclarations";

type UniqueDecl = [string, string, boolean];

interface SelectorInfo {
  /** The original rule node for eventual manipulation */
  rule: postcss.Rule;
  /** The AtRules that scope this selector. */
  scope: RuleScope;
  /** The selector parsed into compound selectors */
  selector: ParsedSelector;
  /** The specificity of this selector */
  specificity: specificity.Specificity;
  /** The file this selector came from */
  file: ParsedCssFile;
  /**
   * The overall index of this selector.
   * Selectors from files with bigger numbers override
   * selectors from files with smaller numbers. */
  fileIndex: number;
  /**
   * A number indicating the general source order. higher numbers come later
   * in the source file.
   */
  sourceIndex: number;
  /** The analyzed elements that this selector might match. */
  elements: Array<Element>;
  /**
   * Quick compare for two selectors to see which wins. This is set once
   * all selectors are sorted initially.
   */
  overallIndex: number;
  /**
   * declarations this selector sets.
   * maps property name to [value, important] pairs. Multiple values are set
   * when the rule set assigns the same property multiple times as is often done
   * for progressive enhancement.
   */
  declarations: Dictionary<UniqueDecl, postcss.Declaration>;
}

interface DeclarationInfo {
  selectorInfo: SelectorInfo;
  decl: postcss.Declaration;
  important: boolean;
}

function compare(n1: number, n2: number): -1 | 0 | 1 {
  if (n1 < n2) return -1;
  if (n1 > n2) return 1;
  return 0;
}

class OptimizationContext {
  /**
   * The key for this optimization context that allows it to be shared across
   * distinct stylesheet regions.
   */
  key: string;
  /** atrule scopes for this context. All are functionally equivalent. */
  scopes: Array<RuleScope>;
  /** runtime selector scoping for this context. */
  selectorContext: string | undefined;

  /**
   * map of long-hand property keys to a dictionary of values multi-mapped to
   * the selector information that references them. The multi-mapped values
   * are in the order of selector precedence. (XXX should we resolve !important right away?)
   */
  declarationInfoMap: MultiDictionary<UniqueDecl, DeclarationInfo>;
  declarations: MultiDictionary<postcss.Declaration, UniqueDecl>;

  constructor(key: string, scope: RuleScope, selectorContext: string | undefined) {
    this.key = key;
    this.scopes = [scope];
    this.selectorContext = selectorContext;
    this.declarationInfoMap = uniqDeclMultiMap();
  }
}

class OptimizationContexts {
  private contexts: {
    [key: string]: OptimizationContext;
  };
  constructor(){
    this.contexts = {};
  }

  *[Symbol.iterator](): IterableIterator<OptimizationContext> {
    for (let key in this.contexts) {
      yield this.contexts[key];
    }
  }

  getContext(scope: RuleScope, selectorContext: string | undefined) {
    let key = this.getKey(scope, selectorContext);
    let context = this.contexts[key];
    if (context) {
      if (context.scopes.indexOf(scope) < 0) {
        context.scopes.push(scope);
      }
    } else {
      context = new OptimizationContext(key, scope, selectorContext);
      this.contexts[key] = context;
    }
    return context;
  }
  getKey(scope: RuleScope, selectorContext: string | undefined): string {
    let key = scope.map(atrule => `@${atrule.name} ${atrule.params}`);
    key.sort((a, b) => a.localeCompare(b));
    if (selectorContext) key.push(selectorContext);
    return key.join(" >> ");
  }
}

/**
 * Efficient navigation of the selectors and declarations of a stylesheet
 * and how they intersect at elements.
 */
class DeclarationMapper {
  contexts: OptimizationContexts;
  /**
   * map of elements to the selectors that match it -- those selectors are in
   * order of lesser to greater precedence. */
  elementSelectors: Map<Element, SelectorInfo[]>;
  /** binary search tree of selectors. sorts as they are added and allows in order traversal. */
  selectorTree: BSTree<SelectorInfo>;
  constructor(
    pass: OptimizationPass,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    files: Array<ParsedCssFile>
  ) {
    this.contexts = new OptimizationContexts();
    this.selectorTree = new BSTree<SelectorInfo>((s1, s2) => {
      let cmp = specificity.compare(s1.specificity.specificityArray, s2.specificity.specificityArray);
      if (cmp === 0) cmp = compare(s1.fileIndex, s2.fileIndex);
      if (cmp === 0) cmp = compare(s1.sourceIndex, s2.sourceIndex);
      return cmp;
    });
    this.elementSelectors = new Map<Element, SelectorInfo[]>();
    files.forEach((file, fileIndex) => {
      let sourceIndex = 0;
      walkRules(file.content.root!, (rule, scope) => {
        sourceIndex++;
        let selectors = pass.cache.getParsedSelectors(rule);
        /** all the declarations of this rule after expanding longhand properties. */
        let declarations  = uniqDeclMultiMap<postcss.Declaration>();
        rule.walkDecls(decl => {
          if (propParser.isShorthandProperty(decl.prop)) {
            let shorthandDeclarations: {[prop: string]: string} = {};
            propParser.getShorthandComputedProperties(decl.prop).forEach(p => {
              shorthandDeclarations[p] = "initial"; // TODO: get the real initial value
            });
            // TODO: normalize values
            Object.assign(
              shorthandDeclarations,
              propParser.expandShorthandProperty(decl.prop, decl.value, true));
            Object.keys(shorthandDeclarations).forEach(prop => {
              declarations.setValue([prop, shorthandDeclarations[prop], decl.important], decl);
            });
          } else {
            // TODO: normalize values. E.g colors of different formats, etc.
            declarations.setValue([decl.prop, decl.value, decl.important], decl);
          }
        });
        selectors.forEach(selector => {
          let elements = new Array<Element>();
          analyses.forEach(analysis => {
            elements.splice(elements.length, 0, ...analysis.querySelector(selector));
          });
          let selectorInfo = {
            rule,
            scope,
            selector,
            specificity: specificity.calculate(selector.toString())[0],
            file,
            fileIndex,
            sourceIndex,
            elements,
            overallIndex: -1,
            declarations
          };
          this.selectorTree.add(selectorInfo);
        });
      });
    });
    let overallIndex = 0;
    this.selectorTree.inorderTraversal((selectorInfo) => {
      console.log(selectorInfo);
      selectorInfo.overallIndex = overallIndex++;
      selectorInfo.elements.forEach(el => {
        let selectors = this.elementSelectors.get(el);
        if (selectors) {
          selectors.push(selectorInfo);
        } else {
          this.elementSelectors.set(el, [selectorInfo]);
        }
      });
      // map properties to selector info
      let context = this.contexts.getContext(selectorInfo.scope, selectorInfo.selector.toContextString());
      selectorInfo.declarations.keys().forEach((uniqueDecl) => {
        let declInfo: Array<DeclarationInfo>;
        if (context.declarationInfoMap.containsKey(uniqueDecl)) {
          declInfo = context.declarationInfoMap.getValue(uniqueDecl);
        } else {
          let di: DeclarationInfo =  {
            selectorInfo,
            decl: selectorInfo.declarations.getValue(uniqueDecl),
            important: uniqueDecl[2],
          };
          declInfo = 
          context.declarationInfoMap.setValue(uniqueDecl, );
        
        let values = selectorInfo.declarations.getValue(prop);
        values.forEach(value => {
          valueInfo.setValue(value[0], {
            important: value[1],
            decl: value[2],
            selectorInfo
          });
        });
      });
      // If we want important property precedence to be pre-calculated it can be
      // done here. It's not clear that's helpful yet.
    });
  }
}

export class ShareDeclarations implements MultiFileOptimization {
  private options: OptiCSSOptions;
  private templateOptions: TemplateIntegrationOptions;
  constructor(options: OptiCSSOptions, templateOptions: TemplateIntegrationOptions) {
    this.options = options;
    this.templateOptions = templateOptions;
  }
  optimizeAllFiles(
    pass: OptimizationPass,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    files: Array<ParsedCssFile>
  ): void {
    let mapper = new DeclarationMapper(pass, analyses, files);
    for (let context of mapper.contexts) {
      for (let decl of context.declarationInfoMap.keys()) {
        let [prop, value, important] = decl;
        let infos = context.declarationInfoMap.getValue(decl);
        if (infos.length > 1) {
          this.mergeDeclarations(pass, context, infos, { prop, value, important: true });
        }
      }
    }
  }
  private isDeclMergable(mapper: DeclarationMapper, info: DeclarationInfo) {
    for (decl of info.selectorInfo.declarations.keys()) {
      mapper. decl
    }
  }
  private mergeDeclarations(
    pass: OptimizationPass,
    context: OptimizationContext,
    decls: Array<DeclarationInfo>,
    decl: Declaration
  ) {
    let scope = context.scopes[0];
    let container = scope.length > 0 ? scope[scope.length - 1] : decls[0].decl.root();
    pass.actions.perform(new MergeDeclarations(
      pass,
      container,
      decl,
      decls.map(id => ({selector: id.selectorInfo.selector, decl: id.decl})),
      "shareDeclarations",
      `Declaration was duplicated ${decls.length} times.`));
  }
}

function declToString(decl: UniqueDecl | postcss.Declaration) {
  let prop: string, value: string, important: boolean;
  if (Array.isArray(decl)) {
    [prop, value, important] = decl;
  } else {
    prop = decl.prop;
    value = decl.value;
    important = decl.important;
  }
  return `${prop}:${value}${important ? ' !important' : ''}`;
}

function uniqDeclMultiMap<T>(equals?: (a: T, b: T) => boolean, allowDuplicates?: boolean): MultiDictionary<UniqueDecl, T> {
  return new MultiDictionary<UniqueDecl, T>(uniq => declToString(uniq), equals, allowDuplicates);
}

function declNodeMultiMap<T>(equals?: (a: T, b: T) => boolean, allowDuplicates?: boolean): MultiDictionary<postcss.Declaration, T> {
  return new MultiDictionary<postcss.Declaration, T>(uniq => declToString(uniq), equals, allowDuplicates);
}
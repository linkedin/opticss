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
  declarations: MultiDictionary<string,[string, boolean, postcss.Declaration]>;
}

interface DeclarationInfo {
  selectorInfo: SelectorInfo;
  decl: postcss.Declaration;
  important: boolean;
  dupeCount: number;
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
  root: postcss.Root;

  /**
   * map of long-hand property keys to a dictionary of values multi-mapped to
   * the selector information that references them. The multi-mapped values
   * are in the order of selector precedence. (XXX should we resolve !important right away?)
   */
  declarationMap: Dictionary<string, MultiDictionary<string, DeclarationInfo>>;

  constructor(key: string, scope: RuleScope, root: postcss.Root, selectorContext: string | undefined) {
    this.key = key;
    this.scopes = [scope];
    this.root = root;
    this.selectorContext = selectorContext;
    this.declarationMap = new Dictionary<string, MultiDictionary<string, DeclarationInfo>>();
  }

  getDeclarationValues(prop: string): MultiDictionary<string, DeclarationInfo> {
    let valueInfo: MultiDictionary<string, DeclarationInfo>;
    if (this.declarationMap.containsKey(prop)) {
      valueInfo = this.declarationMap.getValue(prop);
    } else {
      valueInfo = new MultiDictionary<string, DeclarationInfo>();
      this.declarationMap.setValue(prop, valueInfo);
    }
    return valueInfo;
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

  getContext(root: postcss.Root, scope: RuleScope, selectorContext: string | undefined) {
    let key = this.getKey(scope, selectorContext);
    let context = this.contexts[key];
    if (context) {
      if (context.scopes.indexOf(scope) < 0) {
        context.scopes.push(scope);
      }
    } else {
      context = new OptimizationContext(key, scope, root, selectorContext);
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
  /**
   * All optimization contexts within which, declarations can be merged.
   */
  contexts: OptimizationContexts;
  /**
   * map of elements to the selectors that match it -- those selectors are in
   * order of lesser to greater precedence. */
  elementSelectors: Map<Element, SelectorInfo[]>;

  /** binary search tree of selectors. sorts as they are added and allows in order traversal. */
  selectorTree: BSTree<SelectorInfo>;

  /** map of all shorthand declarations to their expanded declaration information. */
  shortHands: Map<postcss.Declaration, DeclarationInfo[]>;

  constructor(
    pass: OptimizationPass,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    files: Array<ParsedCssFile>
  ) {
    this.shortHands = new Map<postcss.Declaration, DeclarationInfo[]>();
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
        let declarations = new MultiDictionary<string,[string, boolean, postcss.Declaration]>(undefined, undefined, true);
        rule.walkDecls(decl => {
          // TODO: normalize values. E.g colors of different formats, etc.
          declarations.setValue(decl.prop, [decl.value, decl.important, decl]);
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
      let context = this.contexts.getContext(selectorInfo.rule.root(), selectorInfo.scope, selectorInfo.selector.toContextString());
      selectorInfo.declarations.keys().forEach(prop => {
        let values = selectorInfo.declarations.getValue(prop);
        values.forEach(value => {
          let [v, important, decl] = value;
          if (propParser.isShorthandProperty(decl.prop)) {
            let longhandDeclarations: {[prop: string]: string} = {};
            for (let p of expandProperty(decl.prop)) {
              longhandDeclarations[p] = "initial"; // TODO: get the real initial value
            }
            // TODO: normalize values
            Object.assign(
              longhandDeclarations,
              propParser.expandShorthandProperty(decl.prop, decl.value, true));
            Object.keys(longhandDeclarations).forEach(longHandProp => {
              if (!propParser.isShorthandProperty(longHandProp)) {
                let valueInfo = context.getDeclarationValues(longHandProp);
                this.addDeclInfo(selectorInfo, valueInfo, longHandProp, longhandDeclarations[longHandProp], important, decl);
              }
            });
          } else {
            let valueInfo = context.getDeclarationValues(prop);
            this.addDeclInfo(selectorInfo, valueInfo, prop, v, important, decl);
          }
        });
      });
      // If we want important property precedence to be pre-calculated it can be
      // done here. It's not clear that's helpful yet.
    });
  }
  private addDeclInfo(
    selectorInfo: SelectorInfo,
    valueInfo: MultiDictionary<string, DeclarationInfo>,
    prop: string,
    value: string,
    important: boolean,
    decl: postcss.Declaration,
    dupeCount = 0
  ) {
    let declInfo = {
      important,
      decl,
      selectorInfo,
      dupeCount
    };
    if (prop !== declInfo.decl.prop) {
      if (this.shortHands.has(declInfo.decl)) {
        this.shortHands.get(declInfo.decl)!.push(declInfo);
      } else {
        this.shortHands.set(declInfo.decl, [declInfo]);
      }
    }
    valueInfo.setValue(value, declInfo);
  }
}

interface Mergable {
  context: OptimizationContext;
  decls: DeclarationInfo[];
  decl: {
    prop: string;
    value: string;
    important: boolean;
  };
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
    let mergables: Mergable[] = [];
    for (let context of mapper.contexts) {
      for (let prop of context.declarationMap.keys()) {
        let values = context.declarationMap.getValue(prop);
        for (let value of values.keys()) {
          console.log(`${prop}: ${value}`);
          let decls = values.getValue(value);
          let importantDecls = decls.filter(d => d.important);
          let normalDecls = decls.filter(d => !d.important);
          if (importantDecls.length > 1) {
            mergables.push({
              context,
              decls: importantDecls.map(d => {d.dupeCount = importantDecls.length - 1; return d;}),
              decl: { prop, value, important: true }
            });
          }
          if (normalDecls.length > 1) {
            mergables.push({
              context,
              decls: normalDecls.map(d => {d.dupeCount = normalDecls.length - 1; return d;}),
              decl: { prop, value, important: false }
            });
          }
        }
      }
    }
    for (let mergable of mergables) {
      let decls = mergable.decls.filter(d => canMerge(mapper, d));
      if (decls.length > 1) {
        this.mergeDeclarations(pass, mergable.context, decls, mergable.decl);
      }
    }
  }
  private mergeDeclarations(
    pass: OptimizationPass,
    context: OptimizationContext,
    decls: Array<DeclarationInfo>,
    decl: Declaration
  ) {
    let scope = context.scopes[0];
    let container = scope.length > 0 ? scope[scope.length - 1] : context.root;
    pass.actions.perform(new MergeDeclarations(
      pass,
      container,
      decl,
      decls.map(id => ({selector: id.selectorInfo.selector, decl: id.decl})),
      "shareDeclarations",
      "Duplication"));
  }
}

function canMerge(mapper: DeclarationMapper, declInfo: DeclarationInfo): boolean {
  if (!propParser.isShorthandProperty(declInfo.decl.prop)) {
    return true;
  }
  let infos = mapper.shortHands.get(declInfo.decl);
  if (infos) {
    return infos.every(info => info.dupeCount > 0);
  } else {
    throw new Error("Missing decl info for declaration!");
  }
}

function expandProperty(prop: string, recursively = false): string[] {
  let props = propParser.getShorthandComputedProperties(prop);
  if (!recursively) return props;
  while (props.find(p => propParser.isShorthandProperty(p))) {
    props = props.reduce((prev, p) => {
      prev.splice(prev.length, 0, ...propParser.getShorthandComputedProperties(p));
      return prev;
    }, []);
  }
  return props;
}
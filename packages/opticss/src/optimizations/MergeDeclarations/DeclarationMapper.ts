import { Element } from "@opticss/element-analysis";
import { TemplateAnalysis, TemplateTypes } from "@opticss/template-api";
import { MultiMap } from "@opticss/util";
import * as propParser from "css-property-parser";
import * as postcss from "postcss";
import * as specificity from "specificity";
import { BSTree, MultiDictionary } from "typescript-collections";

import { ParsedCssFile } from "../../CssFile";
import { ElementMatcher, matches } from "../../Match";
import { OptimizationPass } from "../../OptimizationPass";
import { ParsedSelector } from "../../parseSelector";
import { walkRules } from "../../util/cssIntrospection";
import {
  expandIfNecessary,
} from "../../util/shorthandProperties";

import {
  OptimizationContext,
  OptimizationContexts,
} from "./OptimizationContext";
import { DeclarationInfo, SelectorInfo } from "./StyleInfo";

/**
 * Efficient navigation of the selectors and declarations of a stylesheet
 * and how they intersect at elements.
 */
export class DeclarationMapper {
  /**
   * All optimization contexts within which, declarations can be merged.
   */
  contexts: OptimizationContexts;
  /**
   * map of elements to the selectors that match it -- those selectors are in
   * order of lesser to greater precedence. */
  elementDeclarations: Map<Element, MultiDictionary<string, DeclarationInfo>>;

  /** binary search tree of selectors. sorts as they are added and allows in order traversal. */
  selectorTree: BSTree<SelectorInfo>;

  /** Each entry for the declaration represents a selector it was duplicated for,
   * and each decl info in that entry, if more than one, represents a longhand
   * it was expanded into from a shorthand.
   */
  declarationInfos: MultiMap<postcss.Declaration, DeclarationInfo[]>;

  constructor(
    pass: OptimizationPass,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    files: Array<ParsedCssFile>,

  ) {
    this.declarationInfos = new MultiMap<postcss.Declaration, DeclarationInfo[]>();
    this.contexts = new OptimizationContexts();
    this.selectorTree = new BSTree<SelectorInfo>((s1, s2) => {
      let cmp = specificity.compare(s1.specificity.specificityArray, s2.specificity.specificityArray);
      if (cmp === 0) cmp = compare(s1.fileIndex, s2.fileIndex);
      if (cmp === 0) cmp = compare(s1.sourceIndex, s2.sourceIndex);
      return cmp;
    });
    let declSourceIndex = 0;
    let declSourceIndexMap = new Map<postcss.Declaration, number>();
    this.elementDeclarations = new Map<Element, MultiDictionary<string, DeclarationInfo>>();
    files.forEach((file, fileIndex) => {
      let sourceIndex = 0;
      walkRules(file.content.root!, (rule, scope) => {
        let selectors = pass.cache.getParsedSelectors(rule);
        /** all the declarations of this rule after expanding longhand properties. */
        let declarations = new MultiDictionary<string, [string, boolean, postcss.Declaration]>(undefined, undefined, true);
        rule.walkDecls(decl => {
          declSourceIndexMap.set(decl, declSourceIndex++);
          // TODO: normalize values. E.g colors of different formats, etc.
          declarations.setValue(decl.prop, [decl.value, decl.important, decl]);
        });
        selectors.forEach(selector => {
          sourceIndex++;
          let elements = new Array<Element>();
          analyses.forEach(analysis => {
            elements.splice(elements.length, 0, ...querySelector(analysis, selector));
          });
          let selectorInfo: SelectorInfo = {
            rule,
            container: rule.parent,
            scope,
            selector,
            specificity: specificity.calculate(selector.toString())[0],
            file,
            fileIndex,
            sourceIndex,
            elements,
            ordinal: -1,
            declarations,
            declarationInfos: new MultiDictionary<[string, string], DeclarationInfo>(),
          };
          let context = this.contexts.getContext(selectorInfo.rule.root(), selectorInfo.scope, selectorInfo.selector.toContext());
          for (let prop of declarations.keys()) {
            context.authoredProps.add(prop);
          }
          this.selectorTree.add(selectorInfo);
        });
      });
    });

    let selectorOrdinal = 1;
    let declarationOrdinal = 1;
    let importantDeclInfos = new Array<DeclarationInfo>();
    this.selectorTree.inorderTraversal((selectorInfo) => {
      selectorInfo.ordinal = selectorOrdinal++;

      // map properties to selector info
      let context = this.contexts.getContext(selectorInfo.rule.root(), selectorInfo.scope, selectorInfo.selector.toContext());
      for (let prop of selectorInfo.declarations.keys()) {
        let values = selectorInfo.declarations.getValue(prop);
        for (let value of values) {
          declarationOrdinal++;
          let [v, important, decl] = value;
          if (propParser.isShorthandProperty(decl.prop)) {
            // We only expand shorthand declarations as much as is necessary within the current optimization context
            // but we need to track declarations globally and against elements according to the fully expanded
            // values because selectors can conflict across different optimization contexts.
            let longhandDeclarations = expandIfNecessary(context.authoredProps, decl.prop, decl.value, pass.actions);
            let longHandProps = Object.keys(longhandDeclarations);
            let longHandDeclInfos = new Array<DeclarationInfo>();
            for (let longHandProp of longHandProps) {
              let declInfo = this.makeDeclInfo(selectorInfo, longHandProp, longhandDeclarations[longHandProp], important, decl, declSourceIndexMap.get(decl)!, declarationOrdinal);
              longHandDeclInfos.push(declInfo);
              if (important) {
                importantDeclInfos.push(declInfo);
              }
              selectorInfo.declarationInfos.setValue([prop, v], declInfo);
              let valueInfo = context.getDeclarationValues(longHandProp);
              valueInfo.setValue(longhandDeclarations[longHandProp], declInfo);
              this.addDeclInfoToElements(selectorInfo.elements, longHandProp, declInfo);
            }
            this.trackDeclarationInfo(context, longHandDeclInfos);
          } else {
            // normal long hand props are just set directly
            let declInfo = this.makeDeclInfo(selectorInfo, prop, v, important, decl, declSourceIndexMap.get(decl)!, declarationOrdinal);
            this.trackDeclarationInfo(context, [declInfo]);
            if (important) {
              importantDeclInfos.push(declInfo);
            }
            let valueInfo = context.getDeclarationValues(prop);
            valueInfo.setValue(v, declInfo);
            this.addDeclInfoToElements(selectorInfo.elements, prop, declInfo);
          }
        }
      }
    });
    // we add the max declaration ordinal to all the important declaration infos
    // this makes those declarations resolve higher than all the non-important values.
    for (let declInfo of importantDeclInfos) {
      declInfo.ordinal = declInfo.ordinal + declarationOrdinal;
    }
  }
  private makeDeclInfo(
    selectorInfo: SelectorInfo,
    prop: string,
    value: string,
    important: boolean,
    decl: postcss.Declaration,
    sourceOrdinal: number,
    ordinal: number,
    dupeCount = 0,

  ): DeclarationInfo {
    let declInfo: DeclarationInfo = {
      decl,
      prop,
      value,
      important,
      selectorInfo,
      sourceOrdinal,
      originalSourceOrdinal: sourceOrdinal,
      ordinal,
      originalOrdinal: ordinal,
      dupeCount,
      expanded: false,
    };
    return declInfo;
  }
  private trackDeclarationInfo(context: OptimizationContext, declInfos: DeclarationInfo[]) {
    for (let info of declInfos) {
      context.declarationInfos.add(info);
    }
    this.declarationInfos.set(declInfos[0].decl, declInfos);
  }

  private addDeclInfoToElements(elements: Element[], property: string, declInfo: DeclarationInfo) {
    for (let el of elements) {
      let declarations = this.elementDeclarations.get(el);
      if (!declarations) {
        let newDecls = new MultiDictionary<string, DeclarationInfo>();
        this.elementDeclarations.set(el, newDecls);
        newDecls.setValue(property, declInfo);
      } else {
        declarations.setValue(property, declInfo);
      }
    }
  }
}

function compare(n1: number, n2: number): -1 | 0 | 1 {
  if (n1 < n2) return -1;
  if (n1 > n2) return 1;
  return 0;
}

function querySelector<T extends keyof TemplateTypes>(
  analysis: TemplateAnalysis<T>, selector: ParsedSelector,

): Array<Element> {
  return analysis.elements.filter(e =>
    matches(ElementMatcher.instance.matchSelector(e, selector, true)));
}

import * as propParser from 'css-property-parser';
import * as postcss from 'postcss';
import * as specificity from 'specificity';
import { BSTree, MultiDictionary } from 'typescript-collections';

import { TemplateTypes, Element, TemplateAnalysis } from '@opticss/template-api';
import { ParsedCssFile } from '../../CssFile';
import { OptimizationPass } from '../../OptimizationPass';
import {
  expandIfNecessary,
  expandPropertyName,
} from '../../util/shorthandProperties';
import { walkRules } from '../util';
import { SelectorInfo, DeclarationInfo } from './StyleInfo';
import { OptimizationContexts } from './OptimizationContext';
import { matches,  ElementMatcher} from "../../Match";
import { ParsedSelector } from '../../parseSelector';

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
    this.elementDeclarations = new Map<Element, MultiDictionary<string, DeclarationInfo>>();
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
            declarationInfos: new MultiDictionary<[string, string], DeclarationInfo>()
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
      selectorInfo.declarations.keys().forEach(prop => {
        let values = selectorInfo.declarations.getValue(prop);
        values.forEach(value => {
          declarationOrdinal++;
          let [v, important, decl] = value;
          if (propParser.isShorthandProperty(decl.prop)) {
            // We only expand shorthand declarations as much as is necessary within the current optimization context
            // but we need to track declarations globally and against elements according to the fully expanded
            // values because selectors can conflict across different optimization contexts.
            let longhandDeclarations = expandIfNecessary(context.authoredProps, decl.prop, decl.value);
            let longHandProps = Object.keys(longhandDeclarations);
            for (let longHandProp of longHandProps) {
              let declInfo = this.makeDeclInfo(selectorInfo, longHandProp, longhandDeclarations[longHandProp], important, decl, declarationOrdinal);
              this.trackShorthand(declInfo);
              if (important) {
                importantDeclInfos.push(declInfo);
              }
              selectorInfo.declarationInfos.setValue([prop, v], declInfo);
              let valueInfo = context.getDeclarationValues(longHandProp);
              valueInfo.setValue(longhandDeclarations[longHandProp], declInfo);
              if (propParser.isShorthandProperty(longHandProp)) {
                let allDecls = expandIfNecessary(new Set(expandPropertyName(longHandProp, true)), longHandProp, longhandDeclarations[longHandProp]);
                for (let longHandProp of Object.keys(allDecls)) {
                  this.addDeclInfoToElements(selectorInfo.elements, longHandProp, declInfo);
                }
              }
            }
          } else {
            // normal long hand props are just set directly
            let declInfo = this.makeDeclInfo(selectorInfo, prop, v, important, decl, declarationOrdinal);
            if (important) {
              importantDeclInfos.push(declInfo);
            }
            let valueInfo = context.getDeclarationValues(prop);
            valueInfo.setValue(v, declInfo);
            this.addDeclInfoToElements(selectorInfo.elements, prop, declInfo);
          }
        });
      });
      // If we want important property precedence to be pre-calculated it can be
      // done here. It's not clear that's helpful yet.
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
    ordinal: number,
    dupeCount = 0
  ): DeclarationInfo {
    return {
      decl,
      prop,
      value,
      important,
      selectorInfo,
      ordinal,
      dupeCount
    };
  }
  private trackShorthand(declInfo: DeclarationInfo) {
    if (this.shortHands.has(declInfo.decl)) {
      this.shortHands.get(declInfo.decl)!.push(declInfo);
    } else {
      this.shortHands.set(declInfo.decl, [declInfo]);
    }
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
  analysis: TemplateAnalysis<T>, selector: ParsedSelector
): Array<Element> {
  return analysis.elements.filter(e =>
    matches(ElementMatcher.instance.matchSelector(e, selector, true)));
}
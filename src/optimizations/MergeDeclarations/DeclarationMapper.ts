import * as propParser from 'css-property-parser';
import * as postcss from 'postcss';
import * as specificity from 'specificity';
import { BSTree, MultiDictionary } from 'typescript-collections';

import { TemplateTypes } from '../..';
import { ParsedCssFile } from '../../CssFile';
import { OptimizationPass } from '../../OptimizationPass';
import { Element } from '../../Selectable';
import { TemplateAnalysis } from '../../TemplateAnalysis';
import { expandIfNecessary } from '../../util/shorthandProperties';
import { walkRules } from '../util';
import { SelectorInfo, DeclarationInfo } from './StyleInfo';
import { OptimizationContexts } from './OptimizationContext';

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
          let selectorInfo: SelectorInfo = {
            rule,
            scope,
            selector,
            specificity: specificity.calculate(selector.toString())[0],
            file,
            fileIndex,
            sourceIndex,
            elements,
            overallIndex: -1,
            declarations,
            declarationInfos: new MultiDictionary()
          };
          this.selectorTree.add(selectorInfo);
        });
      });
    });

    this.selectorTree.inorderTraversal((selectorInfo) => {
      let context = this.contexts.getContext(selectorInfo.rule.root(), selectorInfo.scope, selectorInfo.selector.toContext());
      // At this point we haven't expanded any properties and we shouldn't unless it's possible to find a duplicate value.
      // So we need to enumerate all possible declared properties.
      selectorInfo.declarations.keys().forEach(prop => {
        context.authoredProps.add(prop);
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
      let context = this.contexts.getContext(selectorInfo.rule.root(), selectorInfo.scope, selectorInfo.selector.toContext());
      selectorInfo.declarations.keys().forEach(prop => {
        let values = selectorInfo.declarations.getValue(prop);
        values.forEach(value => {
          let [v, important, decl] = value;
          if (propParser.isShorthandProperty(decl.prop)) {
            let longhandDeclarations = expandIfNecessary(context.authoredProps, decl.prop, decl.value);
            Object.keys(longhandDeclarations).forEach(longHandProp => {
              let valueInfo = context.getDeclarationValues(longHandProp);
              let declValue = this.addDeclInfo(selectorInfo, valueInfo, longHandProp, longhandDeclarations[longHandProp], important, decl);
              selectorInfo.declarationInfos.setValue([prop, v], declValue);
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
  ): DeclarationInfo {
    let declInfo = {
      decl,
      prop,
      value,
      important,
      selectorInfo,
      dupeCount
    };
    if (propParser.isShorthandProperty(declInfo.decl.prop)) {
      if (this.shortHands.has(declInfo.decl)) {
        this.shortHands.get(declInfo.decl)!.push(declInfo);
      } else {
        this.shortHands.set(declInfo.decl, [declInfo]);
      }
    }
    valueInfo.setValue(value, declInfo);
    return declInfo;
  }
}

function compare(n1: number, n2: number): -1 | 0 | 1 {
  if (n1 < n2) return -1;
  if (n1 > n2) return 1;
  return 0;
}

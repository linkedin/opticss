/**
 * @module resolve-cascade
 **/
import * as CSSSelect from "@opticss/css-select";
import * as propParser from "css-property-parser";
import * as parse5 from "parse5";
import * as postcss from "postcss";
import * as specificity from "specificity";

import { bodyElement, parseStylesheet, walkRules } from "./util";

export interface PseudoStates {
  /**
   * Maps the pseudo-state's name to the elements for which
   * that state can affect the computed style of an element.
   */
  [pseudoState: string]: Array<parse5.Element>;
}

export interface StyledPseudoElements {
  /**
   * Maps the pseudo-element's name to its computed style
   * The name does not include the preceding colon(s).
   */
  [pseudoElement: string]: ElementStyle;
}

/**
 * The styles computed from the cascade for an element in a particular state.
 */
export interface ComputedStyle {
  [property: string]: string;
}

export interface MatchedSelector {
  selector: string;
  rule: postcss.Rule;
  specificity: specificity.Specificity;
}

export class ElementStyle {
  matchedSelectors: Array<MatchedSelector>;
  /**
   * Track whether the selectors are out of order and need to be re-sorted;
   */
  private dirty: boolean;
  constructor() {
    this.matchedSelectors = new Array();
    this.dirty = false;
  }
  /**
   * @returns All possible pseudo states for this element and related elements.
   */
  pseudoStates(): PseudoStates {
    return {};
  }
  /**
   * @returns map of pseudo elements with styles to the computed style. The
   * name of the pseudo-element should not include the preceding colon(s).
   */
  styledPseudoElements(): StyledPseudoElements {
    return {};
  }
  pseudoElementStyle(_name: string): ElementStyle {
    return new ElementStyle();
  }
  add(selector: string, rule: postcss.Rule, specificity: specificity.Specificity) {
    this.dirty = true;
    this.matchedSelectors.push({
      selector,
      rule,
      specificity,
    });
  }
  private clean(): void {
    if (this.dirty) {
      this.dirty = false;
      // This is a shitty hack to make sorting stable on v8.
      let indexMap = new Map<MatchedSelector, number>();
      // possible optimization: sort all selectors at the beginning instead
      // of for each element.
      this.matchedSelectors.forEach((m, i) => {
        indexMap.set(m, i);
      });
      this.matchedSelectors.sort((a, b) => {
        let cmp = specificity.compare(a.specificity.specificityArray,
                                      b.specificity.specificityArray);
        if (cmp === 0) {
          return (indexMap.get(a)! < indexMap.get(b)!) ? -1 : 1;
        } else {
          return cmp;
        }
      });
    }
  }
  // TODO: accept argument for pseudo states
  compute(): ComputedStyle {
    this.clean();
    let style: ComputedStyle = {};
    let importantDeclarations = new Array<postcss.Declaration>();
    this.matchedSelectors.forEach(match => {
      match.rule.walkDecls((decl) => {
        if (decl.important) {
          importantDeclarations.push(decl);
        } else {
          Object.assign(style, stylesForDeclaration(decl));
        }
      });
    });
    importantDeclarations.forEach(decl => {
      Object.assign(style, stylesForDeclaration(decl));
    });
    return style;
  }
  debug(): string {
    this.clean();
    let ruleSets = new Array<string>();
    this.matchedSelectors.forEach(m => {
      let declarations = new Array<string>(`${m.selector} {`);
      m.rule.walkDecls(decl => {
        declarations.push("  " + decl.toString());
      });
      declarations.push("}");
      ruleSets.push(declarations.join("\n"));
    });
    return ruleSets.join("\n\n");
  }
}

function stylesForDeclaration(decl: postcss.Declaration): ComputedStyle {
  if (propParser.isShorthandProperty(decl.prop)) {
    let expandedValues = <ComputedStyle>propParser.expandShorthandProperty(decl.prop, decl.value, true, true);
    let expandedProps = Object.keys(expandedValues);
    // this filters out the shorthand props returned by expandShorthandProperty
    // when recursively applied.
    for (let prop of expandedProps) {
      if (propParser.isShorthandProperty(prop)) {
        delete expandedValues[prop];
      }
    }
    return expandedValues;
  } else {
    return {
      [decl.prop]: decl.value,
    };
  }
}

export type FullCascade = Map<parse5.Element, ElementStyle>;

export class Cascade {
  stylesheet: string;
  html: parse5.DefaultTreeDocument;
  constructor(stylesheet: string, html: parse5.DefaultTreeDocument) {
    this.stylesheet = stylesheet;
    this.html = html;
  }
  perform(): Promise<FullCascade> {
    let map = new Map<parse5.Element, ElementStyle>();
    let bodyEl = bodyElement(this.html)!;
    let selectOpts: { strict: true };
    return parseStylesheet(this.stylesheet).then(result => {
      walkRules(result.root!, (rule, scope) => {
        if (scope.length > 0) return; // TODO: add ability to simulate media queries.
        if (rule.selectors) {
          rule.selectors.forEach(selector => {
            let s = specificity.calculate(selector)[0];
            // TODO: handle pseudo states and classes here before selecting.
            try {
              let matchedElements = CSSSelect(selector, bodyEl, selectOpts);
              matchedElements.forEach(e => {
                let style = map.get(e);
                if (!style) {
                  style = new ElementStyle();
                  map.set(e, style);
                }
                style.add(selector, rule, s);
              });
            } catch (e) {
              if (e.message && e.message.match(/unmatched pseudo-(class|element)/)) {
                // pass
              } else {
                throw e;
              }
            }
          });
        }
      });
      return map;
    });
  }
}

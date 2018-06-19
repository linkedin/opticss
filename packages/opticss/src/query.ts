import { Element } from "@opticss/element-analysis";
import postcss = require("postcss");

import { ElementMatcher, matches, rejects } from "./Match";
import { ParsedSelector, parseSelector } from "./parseSelector";
import { walkRules } from "./util/cssIntrospection";

export interface SelectorQuery {
  execute(container: postcss.Container, selectorFactory?: SelectorFactory): ClassifiedParsedSelectors;
}

export interface ParsedSelectorAndRule {
  parsedSelector: ParsedSelector;
  rule: postcss.Rule;
}

export interface ClassifiedParsedSelectors {
  main: ParsedSelectorAndRule[];
  other: {
    [classification: string]: ParsedSelectorAndRule[];
  };
}

export function allParsedSelectors(result: ClassifiedParsedSelectors): ParsedSelector[] {
  let selectors = new Array<ParsedSelector>();
  for (let s of result.main) {
    selectors.push(s.parsedSelector);
  }
  for (let type of Object.keys(result.other)) {
    for (let s of result.other[type]) {
      selectors.push(s.parsedSelector);
    }
  }
  return selectors;
}

export interface SelectorFactory {
  getParsedSelectors(node: postcss.Rule): ParsedSelector[];
}

export class SelectorCache implements SelectorFactory {
  _cache: WeakMap<postcss.Rule, ParsedSelector[]>;
  constructor() {
    this._cache = new WeakMap();
  }
  getParsedSelectors(rule: postcss.Rule): ParsedSelector[] {
    if (this._cache.has(rule)) {
      return this._cache.get(rule)!;
    } else {
      let selectors = parseSelector(rule);
      this._cache.set(rule, selectors);
      return selectors;
    }
  }
  clear(): void {
    this._cache = new WeakMap();
  }
  reset(rule: postcss.Rule): void {
    this._cache.delete(rule);
  }
}

/**
 * This query finds all selectors for which the selector references the given
 * target elements in any compound selector.
 *
 * When negated, it finds all selectors that can be proven to never reference
 * any of the target elements.
 */
export class QuerySelectorReferences implements SelectorQuery {
  targets: Array<Element>;
  negate: boolean;
  constructor(elements: Array<Element>, negate?: boolean) {
    this.targets = elements;
    this.negate = !!negate;
  }
  execute(container: postcss.Container, selectorFactory?: SelectorFactory): ClassifiedParsedSelectors {
    let matchedSelectors: ClassifiedParsedSelectors = {
      main: [],
      other: {},
    };
    walkRules(container, (node) => {
      let parsedSelectors = selectorFactory && selectorFactory.getParsedSelectors(node) || parseSelector(node);
      let found = parsedSelectors.filter((value: ParsedSelector) => {
         return this.targets.find((element) => {
          let match = ElementMatcher.instance.matchSelector(element, value, false);
          return this.negate ? rejects(match) : matches(match);
        }) !== undefined;
      });
      found.forEach((sel) => {
        matchedSelectors.main.push({parsedSelector: sel, rule: node});
      });
    });
    return matchedSelectors;
  }
}

/**
 * This query finds all selectors for which the key selector may match the
 * given element in any of its possible dynamic states.
 *
 * The returned selectors may not actually match depending on the selector
 * context and various combinators.
 */
// export class QueryKeySelector implements SelectorQuery {
//   target: Element;
//   constructor(obj: Element) {
//     this.target = obj;
//   }

//   execute(container: postcss.Container, selectorFactory?: SelectorFactory): ClassifiedParsedSelectors {
//     let matchedSelectors: ClassifiedParsedSelectors = {
//       main: [],
//       other: {},
//     };
//     walkRules(container, (node) => {
//       let parsedSelectors = selectorFactory && selectorFactory.getParsedSelectors(node) || parseSelector(node);
//       let found = parsedSelectors.filter((value: ParsedSelector) => matches(ElementMatcher.instance.matchSelector(this.target, value, true)));
//       found.forEach((sel) => {
//         let key = sel.key;
//         if (key.pseudoelement !== undefined) {
//           if (matchedSelectors.other[key.pseudoelement.value] === undefined) {
//             matchedSelectors.other[key.pseudoelement.value] = [];
//           }
//           matchedSelectors.other[key.pseudoelement.value].push({parsedSelector: sel, rule: node});
//         } else {
//           matchedSelectors.main.push({parsedSelector: sel, rule: node});
//         }
//       });
//     });
//     return matchedSelectors;
//   }
// }

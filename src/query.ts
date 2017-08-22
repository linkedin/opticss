import postcss = require("postcss");
import parseSelector, { ParsedSelector } from "./parseSelector";
import { ElementInfo, willNotMatch } from "./Styleable";

export interface SelectorQuery {
  execute(container: postcss.Container): ClassifiedParsedSelectors;
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

export interface SelectorFactory {
  getParsedSelectors(node: postcss.Rule): ParsedSelector[];
}

export class QueryKeySelector implements SelectorQuery {
  target: ElementInfo;
  constructor(obj: ElementInfo) {
    this.target = obj;
  }

  execute(container: postcss.Container, selectorFactory?: SelectorFactory): ClassifiedParsedSelectors {
    let matchedSelectors: ClassifiedParsedSelectors = {
      main: [],
      other: {}
    };
    container.walkRules((node) => {
      let parsedSelectors = selectorFactory && selectorFactory.getParsedSelectors(node) || parseSelector(node.selector);
      let found = parsedSelectors.filter((value: ParsedSelector) => !willNotMatch(this.target, value.key));
      found.forEach((sel) => {
        let key = sel.key;
        if (key.pseudoelement !== undefined) {
          if (matchedSelectors.other[key.pseudoelement.value] === undefined) {
            matchedSelectors.other[key.pseudoelement.value] = [];
          }
          matchedSelectors.other[key.pseudoelement.value].push({parsedSelector: sel, rule: node});
        } else {
          matchedSelectors.main.push({parsedSelector: sel, rule: node});
        }
      });
    });
    return matchedSelectors;
  }
}

import {
  Selectable,
} from "../../../@opticss/element-analysis/src";
import * as SelectorParser from "postcss-selector-parser";

import { ParsedSelector } from "../parseSelector";

import { Match, matches } from "./Match";

export interface HasSelectorNodes {
  nodes: Array<SelectorParser.Node>;
}

export abstract class Matcher<Type extends Selectable> {

  /**
   * @param [keySelectorOnly=true] When false, this selector can match against
   *   any compound selector in the parsed selector.
   */
  matchSelector(selectable: Type, parsedSelector: ParsedSelector, keySelectorOnly: boolean): Match {
    let matched = parsedSelector.eachCompoundSelector((selector) => {
      if (selector !== parsedSelector.key && keySelectorOnly) return;
      let match = this.matchSelectorComponent(selectable, selector);
      if (matches(match)) return match;
      return;
    });
    return matched || Match.no;
  }

  // Abstract methods for subclasses to implement
  abstract matchSelectorComponent(selectable: Selectable, selector: HasSelectorNodes): Match;
  abstract matchSelectorNode(selectable: Selectable, selector: SelectorParser.Node): Match;

}

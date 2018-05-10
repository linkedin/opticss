import {
  Attribute,
  AttributeNS,
  Element,
  ElementInfo,
} from "../../../@opticss/element-analysis/src";
import { assertNever } from "../../../@opticss/util/src";
import * as SelectorParser from "postcss-selector-parser";
import { inspect } from "util";

import { AttributeMatcher } from "./AttributeMatcher";
import { Match, negate } from "./Match";
import { HasSelectorNodes, Matcher } from "./Matcher";
import { TagMatcher } from "./TagMatcher";

export function isSelector(node: { type: string } | undefined): node is SelectorParser.Selector {
  if (node) {
    return node.type === SelectorParser.SELECTOR;
  } else {
    return false;
  }
}

export function findAttr(element: ElementInfo, name: string, namespaceURL: string | null = null): Attribute | AttributeNS | undefined {
  let attr = element.attributes.find(attr => {
    return attr.name === name && attr.namespaceURL === namespaceURL;
  });
  return attr;
}

export class ElementMatcher extends Matcher<Element>  {
  private constructor() { super(); }
  private static _instance = new ElementMatcher();
  public static get instance() {
    return ElementMatcher._instance;
  }

  matchSelectorComponent(element: Element, selector: HasSelectorNodes): Match {
    let maybe = false;
    for (let node of selector.nodes) {
      let match = this.matchSelectorNode(element, node);
      if (match === Match.no) {
        return match;
      } else if (match === Match.maybe) {
        maybe = true;
      }
    }
    if (maybe) {
      return Match.maybe;
    } else {
      return Match.yes;
    }
  }
  matchSelectorNode(element: Element, node: SelectorParser.Node): Match {
    switch (node.type) {
      case "comment":  // never matters
      case "string":   // only used as a child of other selector nodes.
      case "selector": // only used as a child of other selector nodes.
        return Match.pass;
      case "root":
      case "nesting":
      case "combinator":
        // This is indicative of some sort of programming error.
        throw new Error(`[Internal Error] Illegal selector node: ${inspect(node)}`);
      case "pseudo":
        let pseudo = node;
        if (pseudo.value === ":not") {
          let negSelector = pseudo.nodes[0];
          if (isSelector(negSelector)) {
            return negate(this.matchSelectorComponent(element, negSelector));
          }
        }
      // falls through on purpose
      // most pseudos are equivalent to the universal selector
      case "universal":
        return Match.yes;
      case "class":
      case "id":
        let idOrClass = findAttr(element, node.type);
        if (idOrClass) {
          return AttributeMatcher.instance.matchSelectorNode(idOrClass, node);
        } else {
          return Match.no;
        }
      case "tag":
        return TagMatcher.instance.matchSelectorNode(element.tagname, node);
      case "attribute":
        let ns = node.namespaceString || null;
        let anAttr = findAttr(element, node.attribute, ns);
        if (anAttr) {
          return AttributeMatcher.instance.matchSelectorNode(anAttr, node);
        } else {
          return Match.no;
        }
      default:
        return assertNever(node);
    }
  }
}

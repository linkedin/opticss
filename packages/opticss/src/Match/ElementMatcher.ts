import {
  Element,
  Attribute,
  AttributeNS,
  ElementInfo
} from '@opticss/template-api';
import { inspect } from "util";
import * as SelectorParser from 'postcss-selector-parser';
import { assertNever } from "@opticss/util";

import { Match, negate } from "./Match";
import { TagMatcher } from "./TagMatcher";
import { AttributeMatcher } from "./AttributeMatcher";
import { Matcher, HasSelectorNodes } from "./Matcher";

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
    for (let i = 0; i < selector.nodes.length; i++) {
      let match = this.matchSelectorNode(element, selector.nodes[i]);
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
        let pseudo = <SelectorParser.Pseudo>node;
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

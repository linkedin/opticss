import {
  isConstant,
  isTagChoice,
  isUnknown,
  Tag,
} from "@opticss/element-analysis";
import { assertNever } from "@opticss/util";
import * as SelectorParser from "postcss-selector-parser";

import { boolToMatch, Match } from "./Match";
import { HasSelectorNodes, Matcher } from "./Matcher";

export function isTag(tag: { type: string } | undefined): tag is SelectorParser.Tag {
  if (tag) {
    return tag.type === SelectorParser.TAG;
  } else {
    return false;
  }
}

export class TagMatcher extends Matcher<Tag> {
  private constructor() { super(); }
  private static _instance = new TagMatcher();
  public static get instance() {
    return TagMatcher._instance;
  }
  matchSelectorNode(tag: Tag, node: SelectorParser.Node): Match {
    if (isTag(node)) {
      if (isConstant(tag.value)) {
        return boolToMatch(node.value === tag.value.constant);
      } else if (isTagChoice(tag.value)) {
        return boolToMatch(tag.value.oneOf.some(v => v === node.value));
      } else if (isUnknown(tag.value)) {
        return Match.maybe;
      } else {
        return assertNever(<never>node);
      }
    } else {
      return Match.pass;
    }
  }

  matchSelectorComponent(tag: Tag, selector: HasSelectorNodes): Match {
    let tagNode = this.getTag(selector);
    if (tagNode) {
      return this.matchSelectorNode(tag, tagNode);
    } else {
      return Match.pass;
    }
  }

  private getTag(selector: HasSelectorNodes): SelectorParser.Tag | undefined {
    let node = selector.nodes.find((node) => isTag(node));
    if (node) {
      return node as SelectorParser.Tag;
    } else {
      return undefined;
    }
  }

}

import {
  Attr,
  AttributeValue,
  isAbsent,
  isChoice,
  isConstant,
  isEndsWith,
  isSet,
  isStartsAndEndsWith,
  isStartsWith,
  isUnknown,
  isUnknownIdentifier,
} from "@opticss/element-analysis";
import { assertNever } from "@opticss/util";
import * as SelectorParser from "postcss-selector-parser";
import { Memoize } from "typescript-memoize";

import { boolToMatch, Match, matches } from "./Match";
import { HasSelectorNodes, Matcher } from "./Matcher";

export function isAttrNode(node: SelectorParser.Node): node is SelectorParser.Attribute {
  if (node.type === SelectorParser.ATTRIBUTE) {
    return true;
  } else {
    return false;
  }
}

export class AttributeMatcher extends Matcher<Attr> {
  private constructor() { super(); }
  private static _instance = new AttributeMatcher();
  public static get instance() {
    return AttributeMatcher._instance;
  }

  matchSelectorComponent(attr: Attr, selector: HasSelectorNodes): Match {
    let no = false;
    let maybe = false;
    selector.nodes.forEach(node => {
      let match = this.matchSelectorNode(attr, node);
      switch (match) {
        case Match.no:
          no = true;
          break;
        case Match.maybe:
          maybe = true;
          break;
        case Match.yes:
        case Match.pass:
          break;
        default:
          assertNever(match);
      }
    });
    if (no) {
      return Match.no;
    } else if (maybe) {
      return Match.maybe;
    } else {
      return Match.yes;
    }
  }

  matchSelectorNode(attr: Attr, node: SelectorParser.Node): Match {
    switch (node.type) {
      case "string":
      case "selector":
      case "root":
      case "comment":
      case "combinator":
      case "nesting":
      case "pseudo":
        return Match.pass;
      case "tag":
        return Match.no;
      case "id":
        if (attr.name === "id" && attr.namespaceURL === null) {
          return this.matchIdent(attr, node.value);
        } else {
          return Match.no;
        }
      case "class":
        if (attr.name === "class" && attr.namespaceURL === null) {
          return boolToMatch(this.matchWhitespaceDelimited(attr, node.value));
        } else {
          return Match.no;
        }
      case "attribute":
        let a = node;
        // TODO: unclear whether this is the namespace url or prefix from
        // postcss-selector-parser (it's probably the prefix so this is probably
        // broken).
        if (a.attribute === attr.name && attr.sameNamespace(a.namespaceString)) {
          return this.matchAttributeNode(attr, node);
        } else {
          return Match.no;
        }
      case "universal":
        return Match.yes;
      default:
        return assertNever(node);
    }
  }

  /**
   * Match an attribute against a single string value. This is used
   * by the id selector and some attribute selectors.
   *
   * @param identifier The identifier in the selector to match against the
   *   element's attribute value.
   * @param [value=this.value] the attribute value to match against.
   * @returns boolean if it matches or not
   */
  matchIdent(attr: Attr, identifier: string, value: AttributeValue = attr.value, whitespaceDelimited = false): Match {
    if (isAbsent(value)) {
      return Match.no;
    } else if (isUnknown(value)) {
      return Match.maybe;
    } else if (isUnknownIdentifier(value)) {
      return Match.maybe;
    } else if (isConstant(value)) {
      if (value.constant === identifier) {
        return Match.yes;
      } else {
        return Match.no;
      }
    } else if (isStartsWith(value)) {
      return boolToMatch(identifier.startsWith(value.startsWith));
    } else if (isEndsWith(value)) {
      return boolToMatch(identifier.endsWith(value.endsWith));
    } else if (isStartsAndEndsWith(value)) {
      return boolToMatch(identifier.startsWith(value.startsWith) &&
        identifier.endsWith(value.endsWith));
    } else if (isSet(value)) {
      if (whitespaceDelimited) {
        return boolToMatch(value.allOf.some(v =>
          matches(this.matchIdent(attr, identifier, v, whitespaceDelimited))));
      } else {
        // This is a tricky case. There really shouldn't be an `allOf` used
        // for an identifier match. In theory a regex could be constructed?
        // I'm hesitant to throw an error here but maybe I should?
        return Match.no;
      }
    } else if (isChoice(value)) {
      return boolToMatch(value.oneOf.some(v =>
        matches(this.matchIdent(attr, identifier, v, whitespaceDelimited))));
    } else {
      return assertNever(value);
    }
  }

  /**
   * Match an attribute against an attribute value using space delimited
   * matching semantics. This is used by the class selector and some attribute
   * selectors.
   * @param identifier The identifier in the selector to match against the
   *   element's attribute value.
   * @param [value=this.value] the attribute value to match against.
   * @returns boolean if it matches
   */
  matchWhitespaceDelimited(attr: Attr, identifier: string, value?: AttributeValue): boolean {
    if (!value) {
      value = attr.value;
    }
    if (isAbsent(value)) {
      return false;
    } else if (isUnknown(value)) {
      return true;
    } else if (isUnknownIdentifier(value)) {
      return true;
    } else if (isConstant(value)) {
      return (value.constant === identifier);
    } else if (isStartsWith(value) || isEndsWith(value) || isStartsAndEndsWith(value)) {
      if (value.whitespace) {
        // the unknown part of the attribute can contain whitespace so we have
        // to assume it matches.
        return true;
      }
      if ((isStartsWith(value) || isStartsAndEndsWith(value)) && !identifier.startsWith(value.startsWith)) {
        return false;
      }
      if ((isEndsWith(value) || isStartsAndEndsWith(value)) && !identifier.endsWith(value.endsWith)) {
        return false;
      }
      return true;
    } else if (isSet(value)) {
      return value.allOf.some(v => matches(this.matchIdent(attr, identifier, v, true)));
    } else if (isChoice(value)) {
      return value.oneOf.some(v => matches(this.matchIdent(attr, identifier, v, true)));
    } else {
      return assertNever(value);
    }
  }

  matchAttributeNode(attr: Attr, node: SelectorParser.Node): Match {
    if (!isAttrNode(node)) {
      return Match.no;
    }
    let caseInsensitive = !!node.insensitive;
    if (node.operator === undefined) {
      return Match.yes;
    } else {
      if (attr.value === undefined) return Match.no;
      switch (node.operator) {
        case "=":
          let attrRegex = this.regexForAttrEq(attr, caseInsensitive);
          if (attrRegex.test(node.value!)) {
            if (attr.isAmbiguous()) {
              return Match.maybe;
            } else {
              return Match.yes;
            }
          } else {
            return Match.no;
          }
        default:
          // TODO: Support for attribute operators
          throw new Error(`Unsupported Attribute selector: ${node.toString()}`);
      }
    }
  }

  @Memoize()
  regexForAttrEq(
    attr: Attr,
    caseInsensitive: boolean,
  ): RegExp {
    return new RegExp("^" + this.regexPatternForAttr(attr.value) + "$", caseInsensitive ? "i" : undefined);
  }
  @Memoize()
  regexPatternForAttr(
    condition: AttributeValue,
  ): string {
    if (isUnknown(condition)) {
      return "*";
    } else if (isUnknownIdentifier(condition)) {
      return "[^\\s]+";
    } else if (isAbsent(condition)) {
      return "";
    } else if (isConstant(condition)) {
      return condition.constant;
    } else if (isStartsWith(condition)) {
      let unknownPattern = condition.whitespace ? "*" : "[^\\s]*";
      return `${condition.startsWith}${unknownPattern}`;
    } else if (isEndsWith(condition)) {
      let unknownPattern = condition.whitespace ? "*" : "[^\\s]*";
      return `${unknownPattern}${condition.endsWith}`;
    } else if (isStartsAndEndsWith(condition)) {
      let unknownPattern = condition.whitespace ? "*" : "[^\\s]*";
      return `${condition.startsWith}${unknownPattern}${condition.endsWith}`;
    } else if (isChoice(condition)) {
      return `(?:${condition.oneOf.map(c => this.regexPatternForAttr(c)).join("|")})`;
    } else if (isSet(condition)) {
      return condition.allOf.map(c => this.regexPatternForAttr(c)).join("\\s+");
    } else {
      return assertNever(condition);
    }
  }
}

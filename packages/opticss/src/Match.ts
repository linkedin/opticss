import {
  Attr,
  Element,
  HasSelectorNodes,
  Selectable,
  Tag,
  Attribute,
  AttributeNS,
  ElementInfo,
  AttributeValue,
  isAbsent,
  isUnknown,
  isUnknownIdentifier,
  isConstant,
  isStartsWith,
  isEndsWith,
  isStartsAndEndsWith,
  isSet,
  isChoice,
  isTagChoice,
} from '@opticss/template-api';
import { inspect } from "util";
import { Memoize } from 'typescript-memoize';
import * as SelectorParser from 'postcss-selector-parser';
import { ParsedSelector } from "./parseSelector";

import { assertNever } from "@opticss/util";

export enum Match {
  /**
   * The element will definitively match the selector or selector component in
   * at least dynamic one state.
   */
  yes = 1,
  /**
   * The element may match the selector or selector component; information is
   * ambiguous.
   */
  maybe,
  /** The element will not match the selector or selector component. */
  no,
  /**
   * The element is unrelated to the selector or selector component and no
   * information about whether the element matches can be determined.
   */
  pass
}

/**
 * true => Match.yes
 * false => Match.no
 * null => Match.pass
 * undefined => Match.maybe
 */
export function boolToMatch(value: boolean | null | undefined): Match {
  if (value === true) {
    return Match.yes;
  } else if (value === false) {
    return Match.no;
  } else if (value === undefined) {
    return Match.maybe;
  } else {
    return Match.pass;
  }
}

export interface Matcher {
  matchSelector(selectable: Selectable, selector: ParsedSelector, keySelectorOnly: boolean): Match;
  matchSelectorComponent(selectable: Selectable, selector: HasSelectorNodes): Match;
  matchSelectorNode(selectable: Selectable, node: SelectorParser.Node): Match;
}

export class ElementMatcher implements Matcher {
  private constructor() { }
  private static _instance = new ElementMatcher();
  public static get instance() {
    return ElementMatcher._instance;
  }

  matchSelector(element: Element, selector: ParsedSelector, keySelectorOnly: boolean): Match {
    return matchSelectorImpl(this, element, selector, keySelectorOnly);
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
    switch(node.type) {
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
        let idOrClass = attr(element, node.type);
        if (idOrClass) {
          return AttributeMatcher.instance.matchSelectorNode(idOrClass, node);
        } else {
          return Match.no;
        }
      case "tag":
        return TagMatcher.instance.matchSelectorNode(element.tagname, node) ;
      case "attribute":
        let anAttr = attr(element, (<SelectorParser.Attribute>node).attribute);
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

export class AttributeMatcher implements Matcher {
  private constructor() { }
  private static _instance = new AttributeMatcher();
  public static get instance() {
    return AttributeMatcher._instance;
  }
  matchSelector(attr: Attr, selector: ParsedSelector, keySelectorOnly: boolean): Match {
    return matchSelectorImpl(this, attr, selector, keySelectorOnly);
  }

  matchSelectorComponent(attr: Attr, selector: HasSelectorNodes): Match {
    let no = false;
    let maybe = false;
    selector.nodes.forEach(node => {
      let match = this.matchSelectorNode(attr, node);
      switch(match) {
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
    switch(node.type) {
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
        let a = <SelectorParser.Attribute>node;
        // TODO: unclear whether this is the namespace url or prefix from
        // postcss-selector-parser (it's probably the prefix so this is probably
        // broken).
        if (a.attribute === attr.name && attr.sameNamespace(a.ns)) {
          return this.matchAttributeNode(attr, node);
        } else {
          return Match.no;
        }
      case "universal":
        return Match.yes;
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
  matchIdent(attr: Attr, identifier: string, value: AttributeValue = attr.value): Match {
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
      // This is a tricky case. There really shouldn't be an `allOf` used
      // for an identifier match. In theory a regex could be constructed?
      // I'm hesitant to throw an error here but maybe I should?
      return Match.no;
    } else if (isChoice(value)) {
      return boolToMatch(value.oneOf.some(v =>
        matches(this.matchIdent(attr, identifier, v))));
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
  matchWhitespaceDelimited(attr: Attr, identifier: string, value: AttributeValue = attr.value): boolean {
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
    } else if (isChoice(value)) {
      return value.oneOf.some(v => matches(this.matchIdent(attr, identifier, v)));
    } else if (isSet(value)) {
      return value.allOf.some(v => matches(this.matchIdent(attr, identifier, v)));
    } else {
      throw new Error(`Unexpected value: ${inspect(value)}`);
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
  regexForAttrEq(attr: Attr, caseInsensitive: boolean): RegExp {
    return new RegExp("^" + this.regexPatternForAttr(attr.value) + "$", caseInsensitive ? "i" : undefined);
  }
  @Memoize()
  regexPatternForAttr(condition: AttributeValue): string {
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

export class TagMatcher implements Matcher {
  private constructor() { }
  private static _instance = new TagMatcher();
  public static get instance() {
    return TagMatcher._instance;
  }
  matchSelector(tag: Tag, selector: ParsedSelector, keySelectorOnly: boolean): Match {
    return matchSelectorImpl(this, tag, selector, keySelectorOnly);
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

export function matchToBool(match: Match): boolean | null | undefined {
  switch(match) {
    case Match.yes:
      return true;
    case Match.no:
      return false;
    case Match.maybe:
      return undefined;
    case Match.pass:
      return null;
    default:
      return assertNever(match);
  }
}

export function matches(m: Match): boolean {
  return m === Match.yes || m === Match.maybe;
}

export function rejects(m: Match): boolean {
  return m === Match.no;
}

export function negate(m: Match): Match {
  if (matches(m)) {
    return Match.no;
  } else if (rejects(m)) {
    return Match.yes;
  } else {
    return m;
  }
}

/**
 * @param [keySelectorOnly=true] When false, this selector can match against
 *   any compound selector in the parsed selector.
 */
function matchSelectorImpl(matcher: Matcher, selectable: Selectable, parsedSelector: ParsedSelector, keySelectorOnly = true): Match {
  let matched = parsedSelector.eachCompoundSelector((selector) => {
    if (selector !== parsedSelector.key && keySelectorOnly) return;
    let match = matcher.matchSelectorComponent(selectable, selector);
    if (matches(match)) return match;
    return;
  });
  return matched || Match.no;
}

function attr(element: ElementInfo, name: string, namespaceURL: string | null = null): Attribute | AttributeNS | undefined {
  let attr = element.attributes.find(attr => {
    return attr.name === name &&
           attr.namespaceURL === namespaceURL;
  });
  return attr;
}

function isAttrNode(node: SelectorParser.Node): node is SelectorParser.Attribute {
  if (node.type === SelectorParser.ATTRIBUTE) {
    return true;
  } else {
    return false;
  }
}

function isTag(tag: {type: string} | undefined): tag is SelectorParser.Tag {
  if (tag) {
    return tag.type === SelectorParser.TAG;
  } else {
    return false;
  }
}

function isSelector(node: {type: string} | undefined): node is SelectorParser.Selector {
  if (node) {
    return node.type === SelectorParser.SELECTOR;
  } else {
    return false;
  }
}
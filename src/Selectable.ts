import { inspect } from "util";
import { ParsedSelector } from "./parseSelector";
import * as SelectorParser from "postcss-selector-parser";
import { SourceLocation, POSITION_UNKNOWN } from "./SourceLocation";
import assertNever from "./util/assertNever";
import { Match, matches, boolToMatch, negate as negateMatch } from "./Match";

// TODO: make selectables belong to a template. that template can have template-wide config associated to it.
// E.g. namespace mappings.

export interface HasNamespace {
  readonly namespaceURL: string | null;
}

export interface Selectable {
  matchSelector(selector: ParsedSelector, keySelectorOnly: boolean): Match;
  matchSelectorComponent(selector: HasSelectorNodes): Match;
  matchSelectorNode(node: SelectorParser.Node): Match;
}

// Ok so a quick rundown on the type strategy for tagname and attribute values:
// There are exclusive interfaces that can be passed in and this prevents the
// creation of nonsensical value data like `{unknown: true, value: "asdf"}`. But
// when it comes time to read these values we have to read them off a data type
// where any of the values might be present without introducing a bunch of
// casting So the normalized types are a super set of the types that are
// exclusive when passed as arguments. This keeps us from having to do a bunch
// of casting.

/**
 * A value that contains no dynamic component.
 *
 * Sometimes a dynamic value is one of several known constant values, in those cases
 * a ValueChoice should be used.
 */
export interface ValueConstant {
  constant: string;
}

/**
 * Indicates the value, if it exists, may have any possible value including
 * possibly whitespace characters.
 */
export interface ValueUnknown {
  unknown: true;
}

/**
 * Indicates the value, if it exists, may have any possible value but will
 * only be a single identifier.
 */
export interface ValueUnknownIdentifier {
  unknownIdentifier: true;
}

/**
 * Indicates there is no value.
 */
export interface ValueAbsent {
  absent: true;
}

/**
 * The only thing that is known about the value is a constant prefix.
 *
 * This might be used when a value is set to a constant value concatenated with a dynamic expression.
 * In some cases this is enough information to decide that a selector doesn't match.
 */
export interface ValueStartsWith {
  startsWith: string;
  whitespace: boolean;
}

/**
 * The only thing that is known about the value is a constant suffix.
 *
 * This might be used when a value is set to a constant value concatenated with a dynamic expression.
 * In some cases this is enough information to decide that a selector doesn't match.
 */
export interface ValueEndsWith {
  endsWith: string;
  whitespace: boolean;
}

/**
 * The only thing that is known about the value is a constant prefix and suffix.
 *
 * This might be used when a value has a dynamic expression embedded within a a constant value.
 * In some cases this is enough information to decide that a selector doesn't match.
 */
export type ValueStartsAndEndsWith = ValueStartsWith & ValueEndsWith;

export type AttributeValueChoiceOption =
  ValueAbsent |
  ValueConstant |
  ValueStartsWith |
  ValueEndsWith |
  ValueStartsAndEndsWith |
  AttributeValueSet;

export type NormalizedAttributeValueChoiceOption =
  Partial<ValueAbsent> &
  Partial<ValueConstant> &
  Partial<ValueStartsWith> &
  Partial<ValueEndsWith> &
  Partial<ValueStartsAndEndsWith> &
  Partial<NormalizedAttributeValueSet>;

/**
 * The value may have one of several values.
 * Assumed to match if any of the choices matches.
 */
export interface AttributeValueChoice {
  oneOf: Array<AttributeValueChoiceOption>;
}

export interface NormalizedAttributeValueChoice {
  oneOf: Array<NormalizedAttributeValueChoiceOption>;
}

export type AttributeValueSetItem =
  ValueUnknownIdentifier |
  ValueConstant |
  ValueStartsWith |
  ValueEndsWith |
  ValueStartsAndEndsWith |
  AttributeValueChoice;

export type NormalizedAttributeValueSetItem =
  Partial<ValueUnknownIdentifier> &
  Partial<ValueConstant> &
  Partial<ValueStartsWith> &
  Partial<ValueEndsWith> &
  Partial<ValueStartsAndEndsWith> &
  Partial<NormalizedAttributeValueChoice>;

/**
 * An attribute value set represents a space delimited set of values
 * like you would expect to find in an html class attribute.
 */
export interface AttributeValueSet {
  allOf: Array<AttributeValueSetItem>;
}

export interface NormalizedAttributeValueSet {
  allOf: Array<NormalizedAttributeValueSetItem>;
}

export type AttributeValue =
  ValueAbsent |
  ValueUnknown |
  ValueUnknownIdentifier |
  ValueConstant |
  ValueStartsWith |
  ValueEndsWith |
  ValueStartsAndEndsWith |
  AttributeValueChoice |
  AttributeValueSet;

export type NormalizedAttributeValue =
  Partial<ValueAbsent> &
  Partial<ValueUnknown> &
  Partial<ValueUnknownIdentifier> &
  Partial<ValueConstant> &
  Partial<ValueStartsWith> &
  Partial<ValueEndsWith> &
  Partial<ValueStartsAndEndsWith> &
  Partial<NormalizedAttributeValueChoice> &
  Partial<NormalizedAttributeValueSet>;

export type FlattenedAttributeValueSetItem =
  Partial<ValueUnknownIdentifier> &
  Partial<ValueConstant> &
  Partial<ValueStartsWith> &
  Partial<ValueEndsWith> &
  Partial<ValueStartsAndEndsWith>;

export interface FlattenedAttributeValueSet {
  allOf: Array<FlattenedAttributeValueSetItem>;
}

export type FlattenedAttributeValue =
  Partial<ValueAbsent> &
  Partial<ValueUnknown> &
  Partial<ValueUnknownIdentifier> &
  Partial<ValueConstant> &
  Partial<ValueStartsWith> &
  Partial<ValueEndsWith> &
  Partial<ValueStartsAndEndsWith> &
  Partial<FlattenedAttributeValueSet>;

export interface SerializedAttribute {
  namespaceURL?: string | null;
  name: string;
  value: NormalizedAttributeValue;
}

export interface HasSelectorNodes {
  nodes: Array<SelectorParser.Node>;
}

/**
 * Represents an arbitrary html attribute in a document. Based on the value type it will match against
 * the attribute selector syntax as follows:
 *
 * ValueUnknown:
 *   * Never excludes a selector that involves the attribute.
 *
 * ValueAbsent:
 *   * Will not match selectors that require a value to be present.
 *
 * ValueChoice:
 *   * Will exclude a selector if all of the choices exclude it.
 *
 * ValueConstant:
 *   * [attr] irregardless of the constant value.
 *   * [attr=value] if the constant value is value.
 *   * [attr^=value] if the constant value starts with value.
 *   * [attr$=value] if the constant value ends with value.
 *   * [attr|=value] if the constant value is value or is prefixed value followed by a '-'.
 *   * [attr~=value] if the space-separated constant value includes the word value.
 *   * [attr*=value] if the constant value includes value.
 *
 * ValueStartsWith:
 *   * [attr] irregardless of the startsWith value.
 *   * [attr=value] if the value starts with the startsWith value.
 *   * [attr^=value] if the startsWith value starts with value or vice versa.
 *   * [attr$=value] assumed to match the unspecified trailing value.
 *   * [attr|=value] if the startsWith value starts with '<value>-'
 *   * [attr~=value] assumed to match the unspecified trailing value.
 *   * [attr*=value] assumed to match the unspecified trailing value.
 *
 * ValueEndsWith:
 *   * [attr] irregardless of the endsWith value.
 *   * [attr=value] if the value ends with the endsWith value.
 *   * [attr^=value] assumed to match the unspecified leading value.
 *   * [attr$=value] if the endsWith value ends with value or vice versa.
 *   * [attr|=value] assumed to match against the unspecified leading value.
 *   * [attr~=value] assumed to match the unspecified leading value.
 *   * [attr*=value] assumed to match the unspecified leading value.
 *
 * ValueStartsAndEndsWith:
 *   * [attr] irregardless of the endsWith value.
 *   * [attr=value] if the value starts with the startsWith value and ends with the endsWith value.
 *   * [attr^=value] if the startsWith value starts with value or vice versa.
 *   * [attr$=value] if the endsWith value ends with value or vice versa.
 *   * [attr|=value] if the startsWith value starts with '<value>-'
 *   * [attr~=value] assumed to match the unspecified middle value.
 *   * [attr*=value] assumed to match the unspecified middle value.
 */
export abstract class AttributeBase implements Selectable, HasNamespace {
  private _namespaceURL: string | null;
  private _name: string;
  private _value: NormalizedAttributeValue;

  constructor(namespaceURL: string | null, name: string, value: AttributeValue = { unknown: true }) {
    this._namespaceURL = namespaceURL;
    this._name = name;
    this._value = value;
  }

  get namespaceURL(): string | null {
    return this._namespaceURL;
  }
  get name(): string {
    return this._name;
  }
  get value(): NormalizedAttributeValue {
    return this._value;
  }

  /**
   * Check whether the value is legal according to the attribute's value expression.
   */
  isLegal(value: string, condition?: NormalizedAttributeValue): boolean {
    condition = condition || this.value;
    if (condition.unknown) {
      return true;
    } else if (condition.unknownIdentifier) {
      return !/\s/.test(value);
    } else if (condition.absent) {
      return value.length === 0;
    } else if (condition.constant) {
      return value === condition.constant;
    } else if (condition.startsWith || condition.endsWith) {
      let start = condition.startsWith || "";
      let end = condition.endsWith || "";
      let matches = value.startsWith(start) && value.endsWith(end);
      if (!matches) return false;
      let middle = value.substring(start.length, value.length - end.length);
      return (condition.whitespace || !middle.match(/\s/));
    } else if (condition.oneOf) {
      return condition.oneOf.some(c => this.isLegal(value, c));
    } else if (condition.allOf) {
      let values = value.split(/\s+/);
      // TODO: this is wrong because it allows some classes to be used more than
      // once and others to not be used at all and also because some conditions
      // may require multiple values.
      //
      // The algorithm should be something like:
      // If there is a set value (`allOf`) we must remove all choice values
      // (`oneOf`) by permuting the values into flat lists where each element
      // must be legal against a single value of the split input. each value in
      // split list must be tested against each condition. If there is a value
      // that didn't test true return false for that permutation. If multiple
      // values test true, ensure that there is a value that tests true for each
      // condition once and only once. If there is a permutation that passes
      // exit early and return true otherwise false. This feels like a case
      // where we can apply dynamic programming. Perhaps something like:
      // https://stackoverflow.com/questions/11376672/partial-subtree-matching-algorithm
      //
      // it's not clear if we need this yet, so I'm going to leave it broken for now.
      return condition.allOf.every(c => values.some(v => this.isLegal(v, c)));
    } else {
      return false;
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
  matchIdent(identifier: string, value: NormalizedAttributeValue = this.value): Match {
    if (value.absent) {
      return Match.no;
    } else if (value.unknown) {
      return Match.maybe;
    } else if (value.unknownIdentifier) {
      return Match.maybe;
    } else if (value.constant) {
      if (value.constant === identifier) {
        return Match.yes;
      } else {
        return Match.no;
      }
    } else if (value.startsWith || value.endsWith) {
      if (value.startsWith && !identifier.startsWith(value.startsWith)) {
        return Match.no;
      }
      if (value.endsWith && !identifier.endsWith(value.endsWith)) {
        return Match.no;
      }
      return Match.yes;
    } else if (value.allOf) {
      // This is a tricky case. There really shouldn't be an `allOf` used
      // for an identifier match. In theory a regex could be constructed?
      // I'm hesitant to throw an error here but maybe I should?
      return Match.no;
    } else if (value.oneOf) {
      return boolToMatch(value.oneOf.some(v =>
        matches(this.matchIdent(identifier, v))));
    } else {
      throw new Error(`Unexpected value: ${inspect(value)}`);
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
  matchWhitespaceDelimited(identifier: string, value: NormalizedAttributeValue = this.value): boolean {
    if (value.absent) {
      return false;
    } else if (value.unknown) {
      return true;
    } else if (value.unknownIdentifier) {
      return true;
    } else if (value.constant) {
      return (value.constant === identifier);
    } else if (value.startsWith || value.endsWith) {
      if (value.whitespace) {
        // the unknown part of the attribute can contain whitespace so we have
        // to assume it matches.
        return true;
      }
      if (value.startsWith && !identifier.startsWith(value.startsWith)) {
        return false;
      }
      if (value.endsWith && !identifier.endsWith(value.endsWith)) {
        return false;
      }
      return true;
    } else if (value.allOf || value.oneOf) {
      return (value.allOf || value.oneOf)!.some(v =>
        matches(this.matchIdent(identifier, v)));
    } else {
      throw new Error(`Unexpected value: ${inspect(value)}`);
    }
  }

  matchAttributeNode(node: SelectorParser.Node): Match {
    if (isAttrNode(node)) {
      if (node.operator === undefined) {
        return Match.yes;
      } else {
        // TODO: Support for attribute operators
        throw new Error(`Unsupported Attribute selector: ${node.toString()}`);
      }
    } else {
      return Match.no;
    }
  }

  matchSelectorNode(node: SelectorParser.Node): Match {
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
        if (this.name === "id" && this.namespaceURL === null) {
          return this.matchIdent(node.value);
        } else {
          return Match.no;
        }
      case "class":
        if (this.name === "class" && this.namespaceURL === null) {
          return boolToMatch(this.matchWhitespaceDelimited(node.value));
        } else {
          return Match.no;
        }
      case "attribute":
        let a = <SelectorParser.Attribute>node;
        // TODO: unclear whether this is the namespace url or prefix from
        // postcss-selector-parser (it's probably the prefix so this is probably
        // broken).
        if (a.attribute === this.name && this.sameNamespace(a.ns)) {
          return this.matchAttributeNode(node);
        } else {
          return Match.no;
        }
      case "universal":
        return Match.yes;
    }
  }

  sameNamespace(namespace: string) {
    if (this.namespaceURL === null && namespace === "") {
      return true;
    } else {
      return this.namespaceURL === namespace;
    }
  }

  matchSelectorComponent(selector: HasSelectorNodes): Match {
    let no = false;
    let maybe = false;
    selector.nodes.forEach(node => {
      let match = this.matchSelectorNode(node);
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

  matchSelector(selector: ParsedSelector, keySelectorOnly = true): Match {
    return matchSelectorImpl(this, selector, keySelectorOnly);
  }

  flattenedValue(value: NormalizedAttributeValue = this.value): Array<FlattenedAttributeValue> {
    if (value.allOf) {
        let newSets = new Array<FlattenedAttributeValueSet>();
        newSets.push({
          allOf: new Array<FlattenedAttributeValueSetItem>()
        });
        value.allOf.forEach(v => {
          if (v.oneOf) {
            let res = this.flattenedValue(v);
            let origLength = newSets.length;
            for (let i = 0; i < res.length; i++) {
              for (let j = 0; j < origLength; j++) {
                if (res[i].allOf) {
                  newSets.push({
                    allOf: newSets[j].allOf.concat(res[i].allOf!)
                  });
                } else {
                  newSets.push({
                    allOf: newSets[j].allOf.concat(res[i])
                  });
                }
              }
            }
            for (let j = 0; j < origLength; j++) {
              newSets.shift();
            }
          } else {
            newSets.forEach(newSet => {
              newSet.allOf.push(v);
            });
          }
        });
        return newSets;
    } else if (value.oneOf) {
      let values = new Array<FlattenedAttributeValue>();
      value.oneOf.forEach(v => {
        if (v.allOf) {
          let res = this.flattenedValue(v);
          values = values.concat(res);
        } else {
          values.push(v);
        }
      });
      return values;
    } else {
      return [value];
    }
  }

  valueToString(value: NormalizedAttributeValue): string {
    if (value.unknown) {
      return "???";
    } else if (value.unknownIdentifier) {
      return "?";
    } else if (value.constant) {
      return `${value.constant}`;
    } else if (value.startsWith && value.endsWith) {
      return value.startsWith + "*" + value.endsWith;
    } else if (value.startsWith) {
      return value.startsWith + "*";
    } else if (value.endsWith) {
      return "*" + value.endsWith;
    } else if (value.oneOf) {
      return "(" + value.oneOf.reduce((prev, v) => {
        if (v.absent) {
          prev.push("---");
        } else {
          prev.push(this.valueToString(v));
        }
        return prev;
      }, new Array<string>()).join("|") + ")";
    } else if (value.allOf) {
      return value.allOf.map(v => this.valueToString(v)).join(" ");
    } else {
      throw new Error(`INTERNAL ERROR: Missing case for: ${inspect(value)}`);
    }
  }

  toString() {
    let plainAttr;
    if (this.value.absent) {
      plainAttr = `${this.name}`;
    } else {
      plainAttr = `${this.name}="${this.valueToString(this.value)}"`;
    }

    if (this.namespaceURL) {
      return `${this.namespaceURL}:${plainAttr}`;
    } else {
      return plainAttr;
    }
  }

  toJSON(): SerializedAttribute {
    let result: SerializedAttribute = {
      name: this.name,
      value: this.value,
    };
    if (this.namespaceURL) {
      result.namespaceURL = this.namespaceURL;
    }
    return result;
  }

  static fromJSON(json: SerializedAttribute): AttributeNS | Attribute | Identifier | Class {
    if (json.namespaceURL) {
      return new AttributeNS(json.namespaceURL, json.name, json.value as ValueConstant);
    } else {
      if (name === "id") {
        return new Identifier(json.value as ValueConstant);
      } else if (name === "class") {
        return new Class(json.value as ValueConstant);
      } else {
        return new Attribute(json.name, json.value as ValueConstant);
      }
    }
  }
}

export class AttributeNS extends AttributeBase {
  constructor(namespaceURL: string, name: string, value: AttributeValue = {unknown: true}) {
    super(namespaceURL, name, value);
  }
}

export class Attribute extends AttributeBase {
  constructor(name: string, value: AttributeValue = {unknown: true}) {
    super(null, name, value);
  }
}

export class Identifier extends Attribute {
  constructor(value: AttributeValue = { unknown: true }) {
    super("id", value);
  }
}

export class Class extends Attribute {
  constructor(value: AttributeValue = { unknown: true }) {
    super("class", value);
  }
}

export type Attr = Attribute | AttributeNS | Identifier | Class;

export type Tag = Tagname | TagnameNS;

export interface TagnameValueChoice {
  oneOf: Array<string>;
}

export type TagnameValue =
  ValueUnknown |
  ValueConstant |
  TagnameValueChoice;

export type NormalizedTagnameValue =
  Partial<ValueUnknown> &
  Partial<ValueConstant> &
  Partial<TagnameValueChoice>;

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

export interface SerializedTagname {
  namespaceURL?: string | null;
  value: NormalizedTagnameValue;
}

export abstract class TagnameBase implements Selectable, HasNamespace {
  private _namespaceURL: string | null;
  private _value: NormalizedTagnameValue;
  constructor(namespaceURL: string | null, value: TagnameValue) {
    this._namespaceURL = namespaceURL || null;
    this._value = value;
  }

  get namespaceURL(): string | null {
    return this._namespaceURL;
  }

  get value(): NormalizedTagnameValue {
    return this._value;
  }

  getTag(selector: HasSelectorNodes): SelectorParser.Tag | undefined {
    let node = selector.nodes.find((node) => isTag(node));
    if (node) {
      return node as SelectorParser.Tag;
    } else {
      return undefined;
    }
  }

  matchSelector(selector: ParsedSelector, keySelectorOnly = true): Match {
    return matchSelectorImpl(this, selector, keySelectorOnly);
  }
  matchSelectorComponent(selector: HasSelectorNodes): Match {
    let tag = this.getTag(selector);
    if (tag) {
      return this.matchSelectorNode(tag);
    } else {
      return Match.pass;
    }
  }

  matchSelectorNode(node: SelectorParser.Node): Match {
    if (isTag(node)) {
      if (this.value.constant) {
        return boolToMatch(node.value === this.value.constant);
      } else if (this.value.oneOf) {
        return boolToMatch(this.value.oneOf.some(v => v === node.value));
      } else if (this.value.unknown) {
        return Match.maybe;
      } else {
        return assertNever(<never>node);
      }
    } else {
      return Match.pass;
    }
  }

  valueToString(): string {
    if (this.value.unknown) {
      return "???";
    } else if (this.value.constant) {
      return this.value.constant;
    } else if (this.value.oneOf) {
      return this.value.oneOf.join("|");
    } else {
      throw new Error(`Malformed tagname value: ${inspect(this.value)}`);
    }
  }

  toString() {
    if (this.namespaceURL === null) {
      return `${this.valueToString()}`;
    } else {
      return `${this.namespaceURL}:${this.valueToString()}`;
    }
  }

  toJSON(): SerializedTagname {
    let result: SerializedTagname = {
      value: this.value
    };
    if (this.namespaceURL) {
      result.namespaceURL = this.namespaceURL;
    }
    return result;
  }
  static fromJSON(json: SerializedTagname): TagnameNS | Tagname {
    if (json.namespaceURL) {
      return new TagnameNS(json.namespaceURL, json.value as ValueConstant);
    } else {
      return new Tagname(json.value as ValueConstant);
    }
  }
}

export class TagnameNS extends TagnameBase {
  constructor(namespaceURL: string, value: TagnameValue) {
    super(namespaceURL, value);
  }
}

export class Tagname extends TagnameBase {
  constructor(value: TagnameValue) {
    super(null, value);
  }
}

export interface ElementInfo<TagnameType = Tag, AttributeType = Attr> {
  sourceLocation?: SourceLocation;
  tagname: TagnameType;
  attributes: Array<AttributeType>;
  id?: string;
}

export type SerializedElementInfo = ElementInfo<SerializedTagname, SerializedAttribute>;

export class Element implements ElementInfo, Selectable {
  sourceLocation: SourceLocation;
  tagname: Tag;
  attributes: Array<Attr>;
  id: string | undefined;
  constructor(tagname: Tag, attributes: Array<Attr>, sourceLocation?: SourceLocation, id?: string) {
    this.tagname = tagname;
    this.attributes = attributes;
    this.sourceLocation = sourceLocation || {start: POSITION_UNKNOWN};
    this.id = id;
  }

  static fromElementInfo(info: ElementInfo): Element {
    return new Element(info.tagname, info.attributes, info.sourceLocation, info.id);
  }

  matchSelector(selector: ParsedSelector, keySelectorOnly = true): Match {
    return matchSelectorImpl(this, selector, keySelectorOnly);
  }

  matchSelectorComponent(selector: HasSelectorNodes): Match {
    let maybe = false;
    for (let i = 0; i < selector.nodes.length; i++) {
      let match = this.matchSelectorNode(selector.nodes[i]);
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
  matchSelectorNode(node: SelectorParser.Node): Match {
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
            return negateMatch(this.matchSelectorComponent(negSelector));
          }
        }
        // falls through on purpose
        // most pseudos are equivalent to the universal selector
      case "universal":
        return Match.yes;
      case "class":
      case "id":
        let idOrClass = attr(this, node.type);
        if (idOrClass) {
          return idOrClass.matchSelectorNode(node);
        } else {
          return Match.no;
        }
      case "tag":
        return this.tagname.matchSelectorNode(node);
      case "attribute":
        let anAttr = attr(this, (<SelectorParser.Attribute>node).attribute);
        if (anAttr) {
          return anAttr.matchSelectorNode(node);
        } else {
          return Match.no;
        }
      default:
        return assertNever(node);
    }
  }
  serialize(): SerializedElementInfo {
    let e: SerializedElementInfo = {
      tagname: this.tagname.toJSON(),
      attributes: this.attributes.map(a => a.toJSON())
    };
    if (this.sourceLocation && this.sourceLocation.start.line >= 0) {
      e.sourceLocation = this.sourceLocation;
    }
    return e;
  }
}

/*
function isNamespaceAttr(attr: AttributeBase | undefined): attr is AttributeNS {
  if (attr && attr.namespaceURL) {
    return true;
  } else {
    return false;
  }
}

function isAttr(attr: AttributeBase | undefined): attr is Attribute {
  if (attr && attr.namespaceURL === null) {
    return true;
  } else {
    return false;
  }
}
*/

function isAttrNode(node: SelectorParser.Node): node is SelectorParser.Attribute {
  if (node.type === SelectorParser.ATTRIBUTE) {
    return true;
  } else {
    return false;
  }
}

function attr(element: ElementInfo, name: string, namespaceURL: string | null = null): Attribute | AttributeNS | undefined {
  let attr = element.attributes.find(attr => {
    return attr.name === name &&
           attr.namespaceURL === namespaceURL;
  });
  return attr;
}

function matchSelectorImpl(styleable: Selectable, parsedSelector: ParsedSelector, keySelectorOnly = true): Match {
  let maybe: Match | undefined = undefined;
  let no = parsedSelector.eachCompoundSelector((selector) => {
    if (selector !== parsedSelector.key && keySelectorOnly) return;
    let match = styleable.matchSelectorComponent(selector);
    if (match === Match.no) return match;
    if (match === Match.maybe) maybe = match;
    return;
  });
  return no || maybe || Match.yes;
}
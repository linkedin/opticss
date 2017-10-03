import * as SelectorParser from 'postcss-selector-parser';
import { SourceLocation, POSITION_UNKNOWN } from "./SourceLocation";
import { assertNever } from "@opticss/util";

// TODO: make selectables belong to a template. that template can have template-wide config associated to it.
// E.g. namespace mappings.

export interface HasNamespace {
  readonly namespaceURL: string | null;
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
  whitespace?: boolean;
}

/**
 * The only thing that is known about the value is a constant suffix.
 *
 * This might be used when a value is set to a constant value concatenated with a dynamic expression.
 * In some cases this is enough information to decide that a selector doesn't match.
 */
export interface ValueEndsWith {
  endsWith: string;
  whitespace?: boolean;
}

/**
 * The only thing that is known about the value is a constant prefix and suffix.
 *
 * This might be used when a value has a dynamic expression embedded within a a constant value.
 * In some cases this is enough information to decide that a selector doesn't match.
 */
export type ValueStartsAndEndsWith = ValueStartsWith & ValueEndsWith;
export type ValueStartsAndOrEndsWith = Partial<ValueStartsAndEndsWith>;

export type AttributeValueChoiceOption =
  ValueAbsent |
  ValueConstant |
  ValueStartsWith |
  ValueEndsWith |
  ValueStartsAndEndsWith |
  AttributeValueSet;

/**
 * The value may have one of several values.
 * Assumed to match if any of the choices matches.
 */
export interface AttributeValueChoice {
  oneOf: Array<AttributeValueChoiceOption>;
}

export type AttributeValueSetItem =
  ValueUnknownIdentifier |
  ValueConstant |
  ValueStartsWith |
  ValueEndsWith |
  ValueStartsAndEndsWith |
  AttributeValueChoice;

/**
 * An attribute value set represents a space delimited set of values
 * like you would expect to find in an html class attribute.
 */
export interface AttributeValueSet {
  allOf: Array<AttributeValueSetItem>;
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

export type FlattenedAttributeValueSetItem =
  ValueUnknownIdentifier |
  ValueConstant |
  ValueStartsWith |
  ValueEndsWith |
  ValueStartsAndEndsWith;

export interface FlattenedAttributeValueSet {
  allOf: Array<FlattenedAttributeValueSetItem>;
}

export type FlattenedAttributeValue =
  ValueAbsent |
  ValueUnknown |
  ValueUnknownIdentifier |
  ValueConstant |
  ValueStartsWith |
  ValueEndsWith |
  ValueStartsAndEndsWith |
  FlattenedAttributeValueSet;

export interface SerializedAttribute {
  namespaceURL?: string | null;
  name: string;
  value: AttributeValue;
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
export abstract class AttributeBase implements HasNamespace {
  private _namespaceURL: string | null;
  private _name: string;
  private _value: AttributeValue;
  private _constants: Set<string> | undefined;

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
  get value(): AttributeValue {
    return this._value;
  }

  constants(condition?: AttributeValue): Set<string> {
    if (condition === undefined && this._constants !== undefined) {
      return this._constants;
    }
    let result = new Set<string>();
    condition = condition || this.value;
    if (isConstant(condition)) {
      result.add(condition.constant);
    } else if (isChoice(condition)) {
      for (let c of condition.oneOf) {
        for (let constant of this.constants(c)) {
          result.add(constant);
        }
      }
    } else if (isSet(condition)) {
      for (let c of condition.allOf) {
        for (let constant of this.constants(c)) {
          result.add(constant);
        }
      }
    }
    return result;
  }

  /**
   * Check whether the value is legal according to the attribute's value expression.
   */
  isLegal(value: string, condition?: AttributeValue): boolean {
    condition = condition || this.value;
    if (isUnknown(condition)) {
      return true;
    } else if (isUnknownIdentifier(condition)) {
      return !/\s/.test(value);
    } else if (isAbsent(condition)) {
      return value.length === 0;
    } else if (isConstant(condition)) {
      return value === condition.constant;
    } else if (isStartsWith(condition)) {
      let start = condition.startsWith;
      let matches = value.startsWith(start);
      if (!matches) return false;
      let suffix = value.substring(start.length, value.length);
      return (condition.whitespace || !suffix.match(/\s/));
    } else if (isEndsWith(condition)) {
      let ending = condition.endsWith;
      let matches = value.endsWith(ending);
      if (!matches) return false;
      let prefix = value.substring(0, value.length - ending.length);
      return (!!condition.whitespace || !prefix.match(/\s/));
    } else if (isStartsAndEndsWith(condition)) {
      let start = condition.startsWith;
      let end = condition.endsWith;
      let matches = value.startsWith(start) && value.endsWith(end);
      if (!matches) return false;
      let middle = value.substring(start.length, value.length - end.length);
      return (condition.whitespace || !middle.match(/\s/));
    } else if (isChoice(condition)) {
      return condition.oneOf.some(c => this.isLegal(value, c));
    } else if (isSet(condition)) {
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
      return assertNever(condition);
    }
  }

  isAmbiguous(condition = this.value): boolean {
    if (isUnknown(condition)) {
      return true;
    } else if (isUnknownIdentifier(condition)) {
      return true;
    } else if (isAbsent(condition)) {
      return false;
    } else if (isConstant(condition)) {
      return false;
    } else if (isStartsWith(condition)) {
      return true;
    } else if (isEndsWith(condition)) {
      return true;
    } else if (isStartsAndEndsWith(condition)) {
      return true;
    } else if (isChoice(condition)) {
      return condition.oneOf.some(c => this.isAmbiguous(c));
    } else if (isSet(condition)) {
      return condition.allOf.some(c => this.isAmbiguous(c));
    } else {
      return assertNever(condition);
    }
  }

  sameNamespace(namespace: string | undefined) {
    if (!(this.namespaceURL || namespace)) {
      return true;
    } else {
      return this.namespaceURL === namespace;
    }
  }

  flattenedValue(value: AttributeValue = this.value): Array<FlattenedAttributeValue> {
    if (isSet(value)) {
        let newSets = new Array<FlattenedAttributeValueSet>();
        newSets.push({
          allOf: new Array<FlattenedAttributeValueSetItem>()
        });
        value.allOf.forEach(v => {
          if (isChoice(v)) {
            let res = this.flattenedValue(v);
            let origLength = newSets.length;
            for (let i = 0; i < res.length; i++) {
              for (let j = 0; j < origLength; j++) {
                let vi = res[i];
                if (isFlattenedSet(vi)) {
                  newSets.push({
                    allOf: newSets[j].allOf.concat(vi.allOf)
                  });
                } else if (isAbsent(vi)) {
                  // TODO
                } else if (isUnknown(vi)) {
                  // TODO
                } else {
                  newSets.push({
                    allOf: newSets[j].allOf.concat(vi)
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
    } else if (isChoice(value)) {
      let values = new Array<FlattenedAttributeValue>();
      value.oneOf.forEach(v => {
        if (isSet(v)) {
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

  valueToString(value: AttributeValue): string {
    if (isAbsent(value)) {
      return "---";
    } else if (isUnknown(value)) {
      return "???";
    } else if (isUnknownIdentifier(value)) {
      return "?";
    } else if (isConstant(value)) {
      return `${value.constant}`;
    } else if (isStartsAndEndsWith(value)) {
      return value.startsWith + "*" + value.endsWith;
    } else if (isStartsWith(value)) {
      return value.startsWith + "*";
    } else if (isEndsWith(value)) {
      return "*" + value.endsWith;
    } else if (isChoice(value)) {
      return "(" + value.oneOf.reduce((prev, v) => {
        prev.push(this.valueToString(v));
        return prev;
      }, new Array<string>()).join("|") + ")";
    } else if (isSet(value)) {
      return value.allOf.map(v => this.valueToString(v)).join(" ");
    } else {
      return assertNever(value);
    }
  }

  toString() {
    let plainAttr;
    if (isAbsent(this.value)) {
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
      if (json.name === "id") {
        return new Identifier(json.value as ValueConstant);
      } else if (json.name === "class") {
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

export type Selectable = Element | Tag | Attr;

export interface TagnameValueChoice {
  oneOf: Array<string>;
}
export function isTagnameValueChoice(v: TagnameValue): v is TagnameValueChoice {
  return Object.keys(v).includes("oneOf");
}

export type TagnameValue =
  ValueUnknown |
  ValueConstant |
  TagnameValueChoice;

export interface SerializedTagname {
  namespaceURL?: string | null;
  value: TagnameValue;
}

export abstract class TagnameBase implements HasNamespace {
  private _namespaceURL: string | null;
  private _value: TagnameValue;
  constructor(namespaceURL: string | null, value: TagnameValue) {
    this._namespaceURL = namespaceURL || null;
    this._value = value;
  }

  get namespaceURL(): string | null {
    return this._namespaceURL;
  }

  get value(): TagnameValue {
    return this._value;
  }

  valueToString(): string {
    if (isUnknown(this.value)) {
      return "???";
    } else if (isConstant(this.value)) {
      return this.value.constant;
    } else if (isTagChoice(this.value)) {
      return this.value.oneOf.join("|");
    } else {
      return assertNever(this.value);
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

export class Element implements ElementInfo {
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
  toString() {
    let parts = [];
    parts.push(this.tagname);
    for (let attr of this.attributes) {
      parts.push(attr);
    }
    return `<${parts.join(" ")}>`;
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

export function isAbsent(value: FlattenedAttributeValue | AttributeValue): value is ValueAbsent {
  return (<ValueAbsent>value).absent !== undefined;
}

export function isUnknown(value: FlattenedAttributeValue | AttributeValue | TagnameValue): value is ValueUnknown {
  return (<ValueUnknown>value).unknown !== undefined;
}

export function isUnknownIdentifier(value: FlattenedAttributeValue | AttributeValue): value is ValueUnknownIdentifier {
  return (<ValueUnknownIdentifier>value).unknownIdentifier !== undefined;
}

export function isConstant(value: FlattenedAttributeValue | AttributeValue | TagnameValue): value is ValueConstant {
  return (<ValueConstant>value).constant !== undefined;
}

export function isStartsWith(value: FlattenedAttributeValue | AttributeValue): value is ValueStartsWith {
  return (<ValueStartsWith>value).startsWith !== undefined && (<ValueStartsAndEndsWith>value).endsWith === undefined;
}

export function isEndsWith(value: FlattenedAttributeValue | AttributeValue): value is ValueEndsWith {
  return (<ValueEndsWith>value).endsWith !== undefined && (<ValueStartsAndEndsWith>value).startsWith === undefined;
}

export function isStartsAndEndsWith(value: FlattenedAttributeValue | AttributeValue): value is ValueStartsAndEndsWith {
  return (<ValueStartsAndEndsWith>value).endsWith !== undefined && (<ValueStartsAndEndsWith>value).startsWith !== undefined;
}

export function isChoice(value: FlattenedAttributeValue | AttributeValue): value is AttributeValueChoice {
  return (<AttributeValueChoice>value).oneOf !== undefined;
}

export function isTagChoice(value: TagnameValue): value is TagnameValueChoice {
  return (<TagnameValueChoice>value).oneOf !== undefined;
}

export function isSet(value: AttributeValue): value is AttributeValueSet {
  return (<AttributeValueSet>value).allOf !== undefined;
}

export function isFlattenedSet(value: FlattenedAttributeValue): value is FlattenedAttributeValueSet {
  return (<FlattenedAttributeValueSet>value).allOf !== undefined;
}

export namespace Value {
  export function constant(constant: string): ValueConstant {
    return {constant};
  }
  export function unknown(): ValueUnknown {
    return {unknown: true};
  }
  export function unknownIdentifier(): ValueUnknownIdentifier {
    return {unknownIdentifier: true};
  }
  export function absent(): ValueAbsent {
    return {absent: true};
  }
  export function startsWith(startsWith: string, whitespace?: boolean): ValueStartsWith {
    return {startsWith, whitespace};
  }
  export function endsWith(endsWith: string, whitespace?: boolean): ValueEndsWith {
    return {endsWith, whitespace};
  }
  export function startsAndEndsWith(startsWith: string, endsWith: string, whitespace?: boolean): ValueStartsAndEndsWith {
    return {startsWith, endsWith, whitespace};
  }
  export function allOf(allOf: Array<AttributeValueSetItem>): AttributeValueSet {
    return {allOf};
  }
  export function oneOf(oneOf: Array<AttributeValueChoiceOption>): AttributeValueChoice {
    return {oneOf};
  }
}

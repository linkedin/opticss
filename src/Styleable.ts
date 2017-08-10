import { inspect } from "util";
import { CompoundSelector } from "./parseSelector";
import * as SelectorParser from "postcss-selector-parser";

// TODO: make styleables belong to a template. that template can have template-wide config associated to it.
// E.g. namespace mappings.

export interface Styleable {
  /**
   * Returns true if the styleable can definitively prove that a compound
   * selector will not match an element with this styleable.
   *
   * For instance if a selector was `a.foo` and the styleable was for a tag name `span`,
   * then it would return true. But it would return false for `.foo` because it might match
   * that selector.
   */
  willNotMatch(selector: CompoundSelector): boolean;
}

export interface HasNamespace {
  readonly namespaceURL: string | null;
}

// Ok so a quick rundown on the type strategy for tagname and attribute values:
// There are exclusive interfaces that can be passed in and this prevents the
// creation of nonsensical value data like `{unknown: true, value: "asdf"}`. But
// when it comes time to read these values we have to read them off a data type
// where any of the values might be present without introducing a bunch of
// casting So the normalized types are a superset of the types that are exlusive
// when passed as arguments. This keeps us from having to do a bunch of casting.

/**
 * A value that contains no dynamic component.
 *
 * Sometimes a dynamic value is one of several known constant values, in those cases
 * a ValueChoice should be used.
 */
export interface ValueConstant {
  value: string;
}

/**
 * Indicates the value, if it exists, may have any possible value.
 */
export interface ValueUnknown {
  unknown: true;
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
 * In some clases this is enough information to decide that a selector doesn't match.
 */
export interface ValueStartsWith {
  startsWith: string;
}

/**
 * The only thing that is known about the value is a constant suffix.
 *
 * This might be used when a value is set to a constant value concatenated with a dynamic expression.
 * In some clases this is enough information to decide that a selector doesn't match.
 */
export interface ValueEndsWith {
  endsWith: string;
}

/**
 * The only thing that is known about the value is a constant prefix and suffix.
 *
 * This might be used when a value has a dynamic expression embedded within a a constant value.
 * In some clases this is enough information to decide that a selector doesn't match.
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
  ValueConstant |
  ValueStartsWith |
  ValueEndsWith |
  ValueStartsAndEndsWith |
  AttributeValueChoice;

export type NormalizedAttributeValueSetItem =
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
  ValueConstant |
  ValueStartsWith |
  ValueEndsWith |
  ValueStartsAndEndsWith |
  AttributeValueChoice |
  AttributeValueSet;

export type NormalizedAttributeValue =
  Partial<ValueAbsent> &
  Partial<ValueUnknown> &
  Partial<ValueConstant> &
  Partial<ValueStartsWith> &
  Partial<ValueEndsWith> &
  Partial<ValueStartsAndEndsWith> &
  Partial<NormalizedAttributeValueChoice> &
  Partial<NormalizedAttributeValueSet>;

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
export abstract class AttributeBase implements Styleable, HasNamespace {
  private _namespaceURL: string | null;
  private _name: string;
  private _value: NormalizedAttributeValue;

  constructor(namespaceURL: string | null, name: string, value: AttributeValue = {unknown: true}) {
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

  willNotMatch(selector: CompoundSelector): boolean {
    // TODO
    if (selector) {
      return false;
    } else {
      return false;
    }
  }

  valueToString(value: NormalizedAttributeValue): string {
    if (value.unknown) {
      return "???";
    } else if (value.value) {
      return `${value.value}`;
    } else if (value.startsWith && value.endsWith) {
      return value.startsWith + "*" + value.endsWith;
    } else if (value.startsWith) {
      return value.startsWith + "*";
    } else if (value.endsWith) {
      return "*" + value.endsWith;
    } else if (value.oneOf) {
      return "(" + value.oneOf.reduce((prev, v) => {
        if (v.absent) {
          prev.push("<absent>");
        } else {
          prev.push(this.valueToString(v));
        }
        return prev;
      }, new Array<string>()).join("|") + ")";
    } else {
      return "";
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

function isTag(tag: SelectorParser.Node | undefined): tag is SelectorParser.Tag {
  if (tag) {
    return tag.type === SelectorParser.TAG;
  } else {
    return false;
  }
}

export abstract class TagnameBase implements Styleable, HasNamespace {
  private _namespaceURL: string | null;
  private _value: NormalizedTagnameValue;
  constructor(namespaceURI: string | null, value: TagnameValue) {
    this._namespaceURL = namespaceURI || null;
    this._value = value;
  }

  get namespaceURL(): string | null {
    return this._namespaceURL;
  }

  get value(): NormalizedTagnameValue {
    return this._value;
  }

  willNotMatch(selector: CompoundSelector): boolean {
    if (this.value.unknown) return false;
    let tag = selector.nodes.find((node) => isTag(node));
    if (isTag(tag)) {
      if (this.value.value) {
        return tag.value !== this.value.value;
      } else if (this.value.oneOf) {
        return !this.value.oneOf.some(v => v === tag!.value);
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  valueToString(): string {
    if (this.value.unknown) {
      return "???";
    } else if (this.value.value) {
      return this.value.value;
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
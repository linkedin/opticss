import { inspect } from "util";
// TODO bring CompoundSelector over from css-blocks.
export interface CompoundSelector {

}

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

/**
 * The value may have one of several values.
 * Assumed to match if any of the choices matches.
 */
export interface AttributeValueChoice {
  oneOf: Array<ValueAbsent |
               ValueConstant |
               ValueStartsWith |
               ValueEndsWith |
               ValueStartsAndEndsWith>;
}

/**
 * Normalized result of a value choice to make interacting with it more straightforward with type checking.
 */
export interface NormalizedAttributeValueChoice {
  absent: boolean;
  value?: string;
  startsWith?: string;
  endsWith?: string;
}

export type AttributeValue = ValueAbsent |
                             ValueUnknown |
                             ValueConstant |
                             AttributeValueChoice |
                             ValueStartsWith |
                             ValueEndsWith |
                             ValueStartsAndEndsWith;

/**
 * Normalize result of a value to make interacting with it more straightforward with type checking.
 */
export interface NormalizedAttributeValue extends NormalizedAttributeValueChoice {
  unknown: boolean;
  oneOf?: Array<NormalizedAttributeValueChoice>;
}

/**
 * Normalizes a value so that some properties are always set for performance and type checking.
 */
function normalizeValue(value: AttributeValue): NormalizedAttributeValue {
  let normalized: NormalizedAttributeValue = {
    absent: false,
    unknown: false
  };
  Object.assign(normalized, value);
  return normalized;
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
export abstract class AttributeBase implements Styleable, HasNamespace {
  private _namespaceURL: string | null;
  private _name: string;
  private _value: NormalizedAttributeValue;

  constructor(namespaceURL: string | null, name: string, value: AttributeValue = {unknown: true}) {
    this._namespaceURL = namespaceURL;
    this._name = name;
    this._value = normalizeValue(value);
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

  valueToString(): string {
    // TODO
    return "";
  }

  toString() {
    let plainAttr;
    if (this.value.absent) {
      plainAttr = `${this.name}`;
    } else {
      plainAttr = `${this.name}=${this.valueToString()}`;
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

export interface NormalizedTagnameValue {
  unknown: boolean;
  value?: string;
  oneOf?: Array<string>;
}

export type TagnameValue = ValueUnknown | ValueConstant | TagnameValueChoice;

function normalizeTagname(value: TagnameValue): NormalizedTagnameValue {
  let normalized: NormalizedTagnameValue = {
    unknown: false
  };
  Object.assign(normalized, value);
  return normalized;
}

export abstract class TagnameBase implements Styleable, HasNamespace {
  private _namespaceURL: string | null;
  private _value: NormalizedTagnameValue;
  constructor(namespaceURI: string | null, value: TagnameValue) {
    this._namespaceURL = namespaceURI || null;
    this._value = normalizeTagname(value);
  }

  get namespaceURL(): string | null {
    return this._namespaceURL;
  }

  get value(): NormalizedTagnameValue {
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
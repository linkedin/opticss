import { assertNever } from "@opticss/util";

import {
  HasNamespace,
  ValueConstant,
  ValueUnknown,
  isConstant,
  isUnknown,
} from "./Attribute";

export type Tag = Tagname | TagnameNS;

export interface TagnameValueChoice {
  oneOf: Array<string>;
}
export function isTagChoice(value: TagnameValue): value is TagnameValueChoice {
  return (<TagnameValueChoice>value).oneOf !== undefined;
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

  isStatic(): boolean {
    if (isConstant(this.value)) {
      return true;
    } else if (isTagnameValueChoice(this.value)) {
      return false;
    } else if (isUnknown(this.value)) {
      return false;
    } else {
      return assertNever(this.value);
    }
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
      value: this.value,
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

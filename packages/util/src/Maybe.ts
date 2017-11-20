export type something = string | number | boolean | symbol | object;

export type Maybe<T extends something> = Some<T> | None;
export type None = { v: undefined, error?: string };
export type Some<T extends something> = { v: T };

export function maybe<T extends something>(v: T | undefined, error?: string): Maybe<T> {
  if (typeof v === "undefined") {
    let n: None = {v: undefined};
    if (error) {
      n.error = error;
    }
    return n;
  } else {
    return {v};
  }
}

export function isSome<T extends something>(value: Maybe<T>): value is Some<T> {
  return typeof value.v !== "undefined";
}

export function isNone<T extends something>(value: Maybe<T>): value is None {
  return typeof value.v === "undefined";
}

export class UndefinedValue extends Error {
  constructor(message = "A value was expected.") {
    super(message);
  }
}

export function unwrap<T extends something>(value: Maybe<T>): T {
  if (isNone(value)) {
    if (value.error) {
      throw new UndefinedValue(value.error);
    } else {
      throw new UndefinedValue();
    }
  }
  return value.v;
}
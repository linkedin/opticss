import * as assert from "assert";

export function isDefined<X>(value: X | undefined): {and: (cb: (defValue: X) => any) => void } {
  if (value) {
    return {
      and: function(cb: (v: X) => void) {
        cb(value);
      }
    };
  } else {
    assert(value !== undefined, `expected to be defined`);
    throw new Error("this is unreachable");
  }
}

export function isNotNull<X>(value: X | null): {and: (cb: (defValue: X) => any) => void } {
  if (value) {
    return {
      and: function(cb: (v: X) => void) {
        cb(value);
      }
    };
  } else {
    assert(value !== null, `expected to not be null`);
    throw new Error("this is unreachable");
  }
}

export function isExisting<X>(value: X | null | undefined): {and: (cb: (defValue: X) => any) => void } {
  let exists: X | undefined = undefined;
  isDefined(value).and((value) => {
    isNotNull(value).and((value) => {
      exists = value;
    });
  });
  if (exists) {
    return exists;
  } else {
    throw new Error("this is unreachable");
  }
}
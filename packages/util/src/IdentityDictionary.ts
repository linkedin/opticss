import {
  Dictionary,
} from "typescript-collections";

/**
 * This data structure is effectively a Set but it is optimized for
 * retrieving the instance associated with the set's identity key.
 *
 * If an instance implements this interface, the function will be used to
 * create it's key value by the default implementation. Otherwise a custom
 * toString function can be provided.
 *
 * interface HasIdentity {
 *   [IdentityDictionary.IdentityString]: () => string;
 * }
 *
 * Because the key is a string representation of the object, changes to the
 * values of that object affecting its key's string representation can result
 * in bugs. To manage this, the update function is provided which will keep the
 * identity mapping in sync with any changes to the value within its callback's
 * invocation.
 */
export class IdentityDictionary<T> extends Dictionary<T, T> {
  static IdentityString = Symbol("IdentityDictionary.IdentityString");
  constructor(toStrFunction?: (value: T) => string) {
    super(toStrFunction || defaultToStringFunction);
  }
  /**
   * Add the value, if it's not already there. Returns it or the value
   * that was already there.
   */
  add(value: T): T {
    let existing = this.get(value);
    if (!existing) {
      this.setValue(value, value);
      return value;
    } else {
      return existing;
    }
  }
  /**
   * Update the value and keep its identity key up to date.
   *
   * If the callback returns false, the value is not updated (even if it
   * changes so don't do that).
   *
   * The callback can return a new instance and it will replace the current
   * instance. this may be a bad idea or it may be a great idea depending on
   * your use case.
   *
   * If the callback doesn't return anything, the value will be assumed to have
   * changed and its uniqueness key will be recalculated and updated.
   */
  update(value: T, cb: (value: T) => T | void | undefined | false): void {
    let v = this.get(value) || value;
    let key = this.toStr(v);
    let updated = cb(v);
    if (updated !== false) {
      delete this.table[`$${key}`];
      this.nElements--;
      this.setValue(updated || v, updated || v);
    }
  }
  /**
   * Return whether there is already a value in the IdentityDictionary with
   * this same key.
   */
  has(value: T): boolean {
    return !!this.get(value);
  }
  /**
   * get the instance for the value provided that has the same key.
   */
  get(value: T): T | undefined {
    if (this.containsKey(value)) {
      return this.getValue(value);
    } else {
      return;
    }
  }
  /**
   *  iterate over all values in this identity dictionary.
   */
  *[Symbol.iterator](): IterableIterator<T> {
    for (let k of this.keys()) {
      yield k;
    }
  }
}

function defaultToStringFunction<T>(value: T): string {
  if (value[IdentityDictionary.IdentityString]) {
    return value[IdentityDictionary.IdentityString]();
  } else if (typeof value === "string") {
    return value;
  } else {
    return JSON.stringify(value);
  }
}
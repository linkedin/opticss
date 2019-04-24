import { MultiMap } from "./MultiMap";

export class TwoKeyMultiMap<K1 extends Object, K2 extends Object, V> {
  private _allowDuplicates: boolean;
  readonly [Symbol.toStringTag] = "TwoKeyMultiMap";
  private store: Map<K1, MultiMap<K2, V>>;
  private _sizeOfValues: number;
  private _sizeOfKeys: number;

  /**
   * Creates an instance of MultiMap.
   * @param [allowDuplicates=true] whether or not duplicate values are stored as unique entries in the MultiMap.
   *   When false, values for a given key are deduplicated using a Set.
   */
  constructor(allowDuplicates = true) {
    this._allowDuplicates = allowDuplicates;
    this.store = new Map<K1, MultiMap<K2, V>>();
    this._sizeOfKeys = 0;
    this._sizeOfValues = 0;
  }

  get allowDuplicates(): boolean {
    return this._allowDuplicates;
  }

  /** Alias for `sizeOfKeys()`. */
  get size(): number {
    return this.sizeOfKeys;
  }

  get sizeOfKeys(): number {
    return this._sizeOfKeys;
  }

  get sizeOfValues(): number {
    return this._sizeOfValues;
  }

  /**
   * @returns a list of the values stored. Adding values to this list will not
   *   add them to the MultiMap, use `set(key, value)` for that.
   */
  get(key1: K1, key2: K2): V[] {
    let secondaryKeys = this.store.get(key1);
    if (secondaryKeys === undefined) {
      return [];
    }
    return secondaryKeys.get(key2);
  }

  set(key1: K1, key2: K2, ...values: V[]): this {
    if (values.length === 0) return this;
    let secondaryMap = this.store.get(key1);
    if (!secondaryMap) {
      this._sizeOfKeys++;
      secondaryMap = new MultiMap<K2, V>(this.allowDuplicates);
      this.store.set(key1, secondaryMap);
    }
    let originalValueSize = secondaryMap.sizeOfValues;
    secondaryMap.set(key2, ...values);
    this._sizeOfValues += secondaryMap.sizeOfValues - originalValueSize;

    return this;
  }

  /**
   * set all values from a TwoKeyMultiMap of the same type into this TwoKeyMultiMap.
   */
  setAll(other: TwoKeyMultiMap<K1, K2, V>) {
    for (let [key1, key2, values] of other.entries()) {
      this.set(key1, key2, ...values);
    }
  }

  clear(): void {
    this.store.clear();
    this._sizeOfKeys = 0;
    this._sizeOfValues = 0;
  }

  /**
   * Deletes all values for the given keys.
   */
  delete(key1: K1, key2: K2): boolean {
    let secondaryKeys = this.store.get(key1);
    if (!secondaryKeys) return false;
    let result = secondaryKeys.delete(key2);
    if (result) {
      if (secondaryKeys.size === 0) {
        this.store.delete(key1);
      }
    }
    return true;
  }
  /**
   * deletes one or more values from the list of values for key.
   * @returns the values that were found and deleted.
   */
  deleteValue(key1: K1, key2: K2, ...valuesToDelete: V[]): V[] {
    let secondaryKeys = this.store.get(key1);
    if (!secondaryKeys) return [];
    let originalValueSize = secondaryKeys.sizeOfValues;
    let foundValues = secondaryKeys.deleteValue(key2, ...valuesToDelete);
    this._sizeOfValues += secondaryKeys.sizeOfValues - originalValueSize;
    if (foundValues.length > 0 && !secondaryKeys.has(key2)) {
      this._sizeOfKeys--;
      if (secondaryKeys.size === 0) {
        this.store.delete(key1);
      }
    }
    return foundValues;
  }

  forEach(callback: (values: V[], keys: [K1, K2], map: MultiMap<K1, V>) => void, thisArg?: unknown) {
    this.store.forEach(((secondaryKeys, key1) => {
      secondaryKeys.forEach((values, key2) => {
        callback.call(thisArg, values, [key1, key2], this);
      });
    }));
  }

  forEachValue(callback: (value: V, keys: [K1, K2], map: MultiMap<K1, V>) => void, thisArg?: unknown) {
    this.store.forEach(((secondaryKeys, key1) => {
      secondaryKeys.forEach((values, key2) => {
        for (let value of values) {
          callback.call(thisArg, value, [key1, key2], this);
        }
      });
    }));
  }

  /**
   * checks if the MultiMap has at least one value for the key.
   */
  has(key1: K1, key2: K2): boolean {
    let secondaryKeys = this.store.get(key1);
    if (secondaryKeys) {
      return secondaryKeys.has(key2);
    } else {
      return false;
    }
  }

  /**
   * checks if the MultiMap has the specified value for the key.
   */
  hasValue(key1: K1, key2: K2, value: V): boolean {
    let secondaryKeys = this.store.get(key1);
    if (secondaryKeys) {
      return secondaryKeys.hasValue(key2, value);
    } else {
      return false;
    }
  }

  /**
   *  iterate over all keys and values in this MultiMap.
   */
  [Symbol.iterator](): IterableIterator<[K1, K2, V[]]> {
    return this.entries();
  }

  *entries(): IterableIterator<[K1, K2, V[]]> {
    for (let entry of this.store.entries()) {
      for (let subentry of entry[1]) {
        yield [entry[0], subentry[0], subentry[1]];
      }
    }
  }

  /** iterates over each value of each key providing both key and value. */
  *individualEntries(): IterableIterator<[K1, K2, V]> {
    for (let entry of this.store.entries()) {
      for (let subentry of entry[1]) {
        for (let value of subentry[1]) {
          yield [entry[0], subentry[0], value];
        }
      }
    }
  }

  *keys(): IterableIterator<[K1, K2]> {
    for (let [key1, subKeys] of this.store.entries()) {
      for (let key2 of subKeys.keys()) {
        yield [key1, key2];
      }
    }
  }

  primaryKeys(): IterableIterator<K1> {
    return this.store.keys();
  }

  subKeys(key: K1): IterableIterator<K2> {
    let map = this.store.get(key);
    if (!map) { return (new Set<K2>()).keys(); }
    return map.keys();
  }

  /** iterates over each set of values that are stored in the MultiMap. */
  *values(): IterableIterator<V[]> {
    for (let subKeys of this.store.values()) {
      for (let values of subKeys.values()) {
        yield values;
      }
    }
  }

  /** iterates over each value individually that stored in the MultiMap. */
  *individualValues(): IterableIterator<V> {
    for (let subKeys of this.store.values()) {
      for (let values of subKeys.values()) {
        for (let value of values) {
          yield value;
        }
      }
    }
  }
}

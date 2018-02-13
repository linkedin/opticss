export class MultiMap<K extends Object, V> {
  private _allowDuplicates: boolean;
  readonly [Symbol.toStringTag] = "MultiMap";
  private store: Map<K, V[] | Set<V>>;
  private _size: number;

  /**
   * Creates an instance of MultiMap.
   * @param [allowDuplicates=true] whether or not duplicate values are stored as unique entries in the MultiMap.
   *   When false, values for a given key are deduplicated using a Set.
   */
  constructor(allowDuplicates = true) {
    this._allowDuplicates = allowDuplicates;
    this.store = new Map();
    this._size = 0;
  }

  get allowDuplicates(): boolean {
    return this._allowDuplicates;
  }

  /** Alias for `sizeOfKeys()`. */
  get size(): number {
    return this.store.size;
  }

  get sizeOfKeys(): number {
    return this.store.size;
  }

  get sizeOfValues(): number {
    return this._size;
  }

  /**
   * @returns a list of the values stored. Adding values to this list will not
   *   add them to the MultiMap, use `set(key, value)` for that.
   */
  get(key: K): V[] {
    let res = this.store.get(key);
    if (res === undefined) {
      return [];
    }
    return this.copyValueList(res);
  }

  private copyValueList(values: V[] | Set<V>): V[] {
    return [...values];
  }

  private isSet(v: V[] | Set<V>): v is Set<V> {
    return v instanceof Set;
  }

  set(key: K, ...values: V[]): this {
    if (values.length === 0) return this;
    let res = this.store.get(key);
    let originalSize: number;
    if (res) {
      if (this.isSet(res)) {
        originalSize = res.size;
        for (let v of values) { res.add(v); }
      } else {
        originalSize = res.length;
        res.push(...values);
      }
    } else {
      originalSize = 0;
      if (this.allowDuplicates) {
        res = [...values];
        this.store.set(key, res);
      } else {
        res = new Set(values);
        this.store.set(key, res);
      }
    }
    this._size += (this.isSet(res) ? res.size : res.length) - originalSize;
    return this;
  }

  /**
   * merge another MultiMap of the same type into this one MultiMap.
   */
  merge(other: MultiMap<K, V>) {
    for (let [key1, values] of other.entries()) {
      this.set(key1, ...values);
    }
  }

  clear(): void {
    this.store.clear();
    this._size = 0;
  }

  /**
   * Deletes all values for a given key.
   */
  delete(key: K): boolean {
    let hasValue = this.store.has(key);
    if (!hasValue) return false;
    let valuesForKey = this.store.get(key)!;
    this._size -= this.isSet(valuesForKey) ? valuesForKey.size : valuesForKey.length;
    this.store.delete(key);
    return hasValue;
  }
  /**
   * deletes one or more values from the list of values for key.
   * @returns the values that were found and deleted.
   */
  deleteValue(key: K, ...valuesToDelete: V[]): V[] {
    let found = new Array<V>();
    if (!this.store.has(key)) return found;
    for (let value of valuesToDelete) {
      let valuesForKey = this.store.get(key)!;
      if (!valuesForKey) continue;
      if (this.isSet(valuesForKey)) {
        if (valuesForKey.delete(value)) {
          this._size -= 1;
          found.push(value);
          if (valuesForKey.size === 0) {
            this.store.delete(key);
          }
        }
      } else {
        let start = valuesForKey.indexOf(value);
        while (start >= 0) {
          this._size -= 1;
          valuesForKey.splice(start, 1);
          found.push(value);
          if (valuesForKey.length === 0) {
            this.store.delete(key);
            return found;
          }
          start = valuesForKey.indexOf(value);
        }
      }
    }
    return found;
  }

  forEach(callback: (values: V[], key: K, map: MultiMap<K, V>) => void, thisArg?: any) {
    this.store.forEach(((values, key) => {
      callback.call(thisArg, this.copyValueList(values), key, this);
    }));
  }

  forEachValue(callback: (value: V, key: K, map: MultiMap<K, V>) => void, thisArg?: any) {
    this.store.forEach(((values, key) => {
      for (let value of values) {
        callback.call(thisArg, value, key, this);
      }
    }));
  }

  /**
   * checks if the MultiMap has at least one value for the key.
   */
  has(key: K): boolean {
    return this.store.has(key);
  }

  /**
   * checks if the MultiMap has the specified value for the key.
   */
  hasValue(key: K, value: V): boolean {
    let values = this.store.get(key);
    if (values) {
      if (this.isSet(values)) {
        return values.has(value);
      } else {
        return values.indexOf(value) >= 0;
      }
    } else {
      return false;
    }
  }

  /**
   *  iterate over all keys and values in this MultiMap.
   */
  [Symbol.iterator](): IterableIterator<[K, V[]]> {
    return this.entries();
  }

  *entries(): IterableIterator<[K, V[]]> {
    for (let entry of this.store.entries()) {
      yield [entry[0], this.copyValueList(entry[1])];
    }
  }

  /** iterates over each value of each key providing both key and value. */
  *individualEntries(): IterableIterator<[K, V]> {
    for (let [key, values] of this.store.entries()) {
      for (let value of values) {
        yield [key, value];
      }
    }
  }

  keys(): IterableIterator<K> {
    return this.store.keys();
  }

  /** iterates over each set of values that are stored in the MultiMap. */
  *values(): IterableIterator<V[]> {
    for (let values of this.store.values()) {
      yield this.copyValueList(values);
    }
  }

  /** iterates over each value individually that stored in the MultiMap. */
  *individualValues(): IterableIterator<V> {
    for (let values of this.store.values()) {
      for (let value of values) {
        yield value;
      }
    }
  }
}
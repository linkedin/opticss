/**
 * Types representing having no value for various reasons.
 */
export type nothing = null | undefined | void;
export function isNothing(v: unknown): v is nothing {
  return v === null || v === undefined;
}

/**
 * Falsy in JS isn't always what you want. Somethings aren't nothings.
 */
export type something = string | number | boolean | symbol | object;
export function isSomething(v: unknown): v is something {
  return !isNothing(v);
}

/**
 * Any value that isn't undefined or void. null is considered defined because
 * something that is null represents the state of knowingly having no value.
 */
export type defined = something | null;
export function isDefined(v: unknown): v is defined {
  return v !== undefined;
}

/**
 * undefined is not an object... but null is... but not in typescript.
 */
export function isObject(v: unknown): v is object {
  return (typeof v === "object" && v !== null);
}
export function isString(v: unknown): v is string {
  return (typeof v === "string");
}
export interface ObjectDictionary<T> {
  [prop: string]: T;
}
export function isObjectDictionary<T extends unknown>(
  dict: unknown,
  typeGuard: TypeGuard<T>,
) {
  if (!isObject(dict)) return false;
  for (let k of Object.keys(dict)) {
    if (!typeGuard(dict[k])) {
      return false;
    }
  }
  return true;
}

export type Keys<Obj extends object> = Extract<keyof Obj, string>;

/**
 * Create an object dictionary given a map object with string keys.
 */
export function objectDictionaryFromMap<T>(map: Map<string, T>): ObjectDictionary<T> {
  let d: ObjectDictionary<T> = {};
  for (let key of map.keys()) {
    d[key] = map.get(key)!;
  }
  return d;
}

/**
 * This is like Object.values() but for an object where the values
 * all have the same type so the value type can be inferred.
 */
export function objectValues<T>(dict: ObjectDictionary<T>): Array<T> {
  let keys = Object.keys(dict);
  return keys.map(k => dict[k]);
}

export type StringDict = ObjectDictionary<string>;
export function isStringDict(dict: unknown): dict is StringDict {
  return isObjectDictionary(dict, isString);
}

/**
 * Set a value to the type of values in an array.
 */
export type ItemType<T extends Array<unknown>> = T[0];

/**
 * represents a TypeScript type guard function.
 */
export type TypeGuard<T extends A, A extends unknown = unknown> = (v: A) => v is T;

/** A function that takes no arguments. */
export type FunctionCall0<R> = () => R;
/** A function that takes a single argument. */
export type FunctionCall1<A1, R> = (arg1: A1) => R;
/** A function that takes a two arguments. */
export type FunctionCall2<A1, A2, R> = (arg1: A1, arg2: A2) => R;
/** A function that takes a three arguments. */
export type FunctionCall3<A1, A2, A3, R> = (arg1: A1, arg2: A2, arg3: A3) => R;
/** A function that takes a four arguments. */
export type FunctionCall4<A1, A2, A3, A4, R> = (arg1: A1, arg2: A2, arg3: A3, arg4: A4) => R;

/**
 * Given a type guard function, return the first element in an array that
 * matches it and correctly infer the type of the returned value.
 *
 * @param ary The array being searched.
 * @param guard The type guard function.
 */
export function firstOfType<
  ArrayType extends unknown,
  GuardType extends ArrayType,
>(
  ary: Array<ArrayType>,
  guard: TypeGuard<GuardType, ArrayType>,
): GuardType | undefined {
  let e: ArrayType;
  for (e of ary) {
    if (guard(e)) {
      return e;
    }
  }
  return undefined;
}

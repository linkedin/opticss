/**
 * Types representing having no value for various reasons.
 */
export type nothing = null | undefined | void;
export function isNothing(v: whatever): v is nothing {
  return v === null || v === undefined;
}

/**
 * Falsy in JS isn't always what you want. Somethings aren't nothings.
 */
export type something = string | number | boolean | symbol | object;
export function isSomething(v: whatever): v is something {
  return !isNothing(v);
}

/**
 * Any value that isn't undefined or void. null is considered defined because
 * something that is null represents the state of knowingly having no value.
 */
export type defined = something | null;
export function isDefined(v: whatever): v is defined {
  return v !== undefined;
}

/**
 * TypeScript imbues `any` with dangerous special powers to access unknown
 * properties and assume that values are defined by the type checker.
 * Code that uses `any` removes type checking and makes our code less safe --
 * so we avoid `any` except in rare cases.
 *
 * If you need to represent a value that can be anything and might not even
 * have a value, without making dangerous assumptions that come along with
 * `any`, use whatever instead.
 */
export type whatever = something | nothing;
/**
 * This type guard is only useful for down casting an any to whatever.
 * Note: You can just *cast* to `whatever` from `any` with zero runtime
 * overhead, but this type guard is provided for completeness.
 */
export function isWhatever(_v: whatever): _v is whatever {
  return true;
}

/**
 * undefined is not an object... but null is... but not in typescript.
 */
export function isObject(v: whatever): v is object {
  return (typeof v === "object" && v !== null);
}
export function isString(v: whatever): v is string {
  return (typeof v === "string");
}
export interface ObjectDictionary<T> {
  [prop: string]: T;
}
export function isObjectDictionary<T>(
  dict: whatever,
  typeGuard: TypeGuard<whatever, T>,
) {
  if (!isObject(dict)) return false;
  for (let k of Object.keys(dict)) {
    if (!typeGuard(dict[k])) {
      return false;
    }
  }
  return true;
}

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
export function isStringDict(dict: whatever): dict is StringDict {
  return isObjectDictionary(dict, isString);
}

/**
 * Set a value to the type of values in an array.
 */
export type ItemType<T extends Array<whatever>> = T[0];

/**
 * represents a TypeScript type guard function.
 */
export type TypeGuard<A extends whatever, T extends A> = (v: A) => v is T;

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
  ArrayType extends whatever,
  GuardType extends ArrayType,
>(
  ary: Array<ArrayType>,
  guard: TypeGuard<ArrayType, GuardType>,
): GuardType | undefined {
  let e: ArrayType;
  for (e of ary) {
    if (guard(e)) {
      return e;
    }
  }
  return undefined;
}

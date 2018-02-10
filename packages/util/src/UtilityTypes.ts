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
export function isWhatever(_v: any): _v is whatever {
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
  typeGuard: (v: whatever) => v is T,
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
export type ItemType<T extends Array<any>> = T[0];

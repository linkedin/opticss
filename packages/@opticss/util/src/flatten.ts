import { whatever } from "./UtilityTypes";

// A recursive type definition has to use an interface to resolve the recursive definitions.
// See: https://github.com/Microsoft/TypeScript/issues/3496#issuecomment-128553540
export type NestedArrayValue<T> = T extends Array<whatever> ? never: T | NestedArray<T>;
export interface NestedArray<T> extends Array<NestedArrayValue<T>> {}

/**
 * returns an array where any array found within the specified array is
 * replaced by its contents recursively.
 *
 * @param array An infinitely nestable array of homogeneous data.
 */
export function flatten<T>(array: NestedArray<T>): T[] {
  if (array.findIndex((item) => Array.isArray(item)) < 0) {
    // avoid making a new array object and moving data to it unnecessarily
    return <T[]>array;
  } else {
    let acc = new Array<T>();
    for (let val of array) {
      if (Array.isArray(val)) {
        acc = acc.concat(flatten(val));
      } else {
        acc.push(<T>val);
      }
    }
    return acc;
  }
}

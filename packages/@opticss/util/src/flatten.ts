export type NestedArrayValue<V> = V | NestedArray<V>;
export interface NestedArray<T> extends Array<NestedArrayValue<T>> {}

// tslint:disable-next-line:prefer-whatever-to-any
function hasSubArray(a: Array<any>): boolean {
  return a.some(i => Array.isArray(i));
}

/**
 * returns an array where any array found within the specified array is
 * replaced by its contents recursively.
 *
 * @param array An infinitely nestable array of homogeneous data.
 */
export function flatten<T>(array: NestedArray<T>) {
  if (!hasSubArray(array)) {
    // avoid making a new array object and moving data to it unnecessarily
    return <T[]>array;
  } else {
    let acc = new Array<T>();
    for (let val of array) {
      if (Array.isArray(val)) {
        acc = acc.concat(flatten(val));
      } else {
        acc.push(val);
      }
    }
    return acc;
  }
}

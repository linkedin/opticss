export interface ObjectDictionary<T> {
  [prop: string]: T;
}

export function objectValues<T>(dict: ObjectDictionary<T>): Array<T> {
  let keys = Object.keys(dict);
  return keys.map(k => dict[k]);
}

export type StringDict = ObjectDictionary<string>;

export type ItemType<T extends Array<any>> = T[0];

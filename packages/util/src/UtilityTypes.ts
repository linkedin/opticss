export interface ObjectDictionary<T> {
  [prop: string]: T;
}

export type StringDict = ObjectDictionary<string>;

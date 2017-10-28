export interface ObjectDictionary<T> {
  [prop: string]: T;
}

export type StringDict = ObjectDictionary<string>;

export type something = string | number | boolean | symbol | object;
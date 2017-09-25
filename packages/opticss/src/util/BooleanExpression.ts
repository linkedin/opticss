export type BooleanExpression<V> = AndExpression<V> | OrExpression<V> | NotExpression<V>;

export interface AndExpression<V> {
  and: Array<V | BooleanExpression<V>>;
}

export interface OrExpression<V> {
  or: Array<V | BooleanExpression<V>>;
}

export interface NotExpression<V> {
  not: V | BooleanExpression<V>;
}

export function isAndExpression<V>(expr: BooleanExpression<V>): expr is AndExpression<V> {
  return Array.isArray((<AndExpression<V>>expr).and);
}

export function isOrExpression<V>(expr: BooleanExpression<V>): expr is OrExpression<V> {
  return Array.isArray((<OrExpression<V>>expr).or);
}

export function isNotExpression<V>(expr: BooleanExpression<V>): expr is OrExpression<V> {
  return Object.keys(expr).includes("not");
}
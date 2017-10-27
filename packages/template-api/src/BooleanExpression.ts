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

export function not<V>(value: V | BooleanExpression<V>): NotExpression<V> {
  return {not: value};
}

export function and<V>(...values: Array<V | BooleanExpression<V>>): AndExpression<V> {
  return {and: values};
}

export function or<V>(...values: Array<V | BooleanExpression<V>>): OrExpression<V> {
  return {or: values};
}

export function isBooleanExpression(expr: any): expr is BooleanExpression<any> {
  if (typeof expr === "object") {
    let be = <BooleanExpression<any>>expr;
    return isAndExpression(be) || isOrExpression(be) || isNotExpression(be);
  } else {
    return false;
  }
}

export function isAndExpression<V>(expr: BooleanExpression<V>): expr is AndExpression<V> {
  return Array.isArray((<AndExpression<V>>expr).and);
}

export function isOrExpression<V>(expr: BooleanExpression<V>): expr is OrExpression<V> {
  return Array.isArray((<OrExpression<V>>expr).or);
}

export function isNotExpression<V>(expr: BooleanExpression<V>): expr is NotExpression<V> {
  return Object.keys(expr).includes("not");
}
import { isObject, something, TypeGuard, whatever } from "@opticss/util";

export interface AndExpression<V extends something> {
  and: Array<V | BooleanExpression<V>>;
}

export interface OrExpression<V extends something> {
  or: Array<V | BooleanExpression<V>>;
}

export interface NotExpression<V extends something> {
  not: V | BooleanExpression<V>;
}

export type BooleanExpression<V> = AndExpression<V> | OrExpression<V> | NotExpression<V>;

export function not<V extends something>(value: V | BooleanExpression<V>): NotExpression<V> {
  return {not: value};
}

export function and<V extends something>(...values: Array<V | BooleanExpression<V>>): AndExpression<V> {
  return {and: values};
}

export function or<V extends something>(...values: Array<V | BooleanExpression<V>>): OrExpression<V> {
  return {or: values};
}

export function isBooleanExpression(expr: whatever): expr is BooleanExpression<something>;
export function isBooleanExpression<T extends something>(expr: whatever, typeGuard: TypeGuard<T>): expr is BooleanExpression<T>;
export function isBooleanExpression<T extends something = something>(expr: whatever, typeGuard?: TypeGuard<T>): expr is BooleanExpression<something> {
  if (isObject(expr)) {
    if (typeGuard) {
      return isAndExpression(expr, typeGuard)
          || isOrExpression(expr, typeGuard)
          || isNotExpression(expr, typeGuard);
    } else {
      return isAndExpression(expr)
          || isOrExpression(expr)
          || isNotExpression(expr);
    }
  } else {
    return false;
  }
}

export function isAndExpression(expr: Partial<BooleanExpression<something>>): expr is AndExpression<something>;
export function isAndExpression<V extends something>(expr: Partial<BooleanExpression<V>>, typeGuard: TypeGuard<V>): expr is AndExpression<V>;
export function isAndExpression<V extends something>(expr: Partial<BooleanExpression<V>>, typeGuard?: TypeGuard<V>): expr is AndExpression<V> {
  let a = (<Partial<AndExpression<V>>>expr).and;
  if (Array.isArray(a)) {
    if (typeGuard && a.length > 0) {
      return a.every(i => isBooleanExpression(i, typeGuard) || typeGuard(i));
    } else {
      return true;
    }
  } else {
    return false;
  }
}

export function isOrExpression(expr: Partial<BooleanExpression<something>>): expr is OrExpression<something>;
export function isOrExpression<V extends something>(expr: Partial<BooleanExpression<V>>, typeGuard: TypeGuard<V>): expr is OrExpression<V>;
export function isOrExpression<V extends something>(expr: Partial<BooleanExpression<V>>, typeGuard?: TypeGuard<V>): expr is OrExpression<V> {
  let a = (<Partial<OrExpression<V>>>expr).or;
  if (Array.isArray(a)) {
    if (typeGuard && a.length > 0) {
      return a.every(i => isBooleanExpression(i, typeGuard) || typeGuard(i));
    } else {
      return true;
    }
  } else {
    return false;
  }
}

export function isNotExpression(expr: Partial<BooleanExpression<something>>): expr is NotExpression<something>;
export function isNotExpression<V extends something>(expr: Partial<BooleanExpression<V>>, typeGuard: TypeGuard<V>): expr is NotExpression<V>;
export function isNotExpression<V extends something>(expr: Partial<BooleanExpression<V>>, typeGuard?: TypeGuard<V>): expr is NotExpression<V> {
  let notExpr = (<Partial<NotExpression<V>>>expr).not;
  if (typeGuard) {
    return isBooleanExpression(notExpr, typeGuard) || typeGuard(notExpr);
  } else {
    return notExpr !== undefined;
  }
}

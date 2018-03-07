import { defined, FunctionCall0, FunctionCall1, FunctionCall2, FunctionCall3, FunctionCall4, something, TypeGuard } from "./UtilityTypes";
import { isObject, whatever } from "./index";

/**
 * Maybe.ts - A TypeScript implementation of the Maybe Monad.
 * ==========================================================
 *
 * Usually a Maybe is strong type with methods, but that approach, I felt,
 * would lead to poor performance characteristics and also not take full
 * advantage of TypeScript's specific approach to types using type guards.
 *
 * Other Maybe libraries found in my research, attempt to emulate pattern
 * matching. This approach was explicitly rejected because this would incur the
 * cost of creating new objects and functional closures unnecessarily when
 * simple branching via type guards will suffice with only minimal impact to
 * code legibility.
 *
 * In this Maybe implementation, the None has an associated error object or
 * error message that can be provided at the point where the None was first
 * created. If provided, that is the error which is raised when a None is
 * unwrapped.
 *
 * The error message is particularly useful in combination with `attempt`,
 * which executes a callback and if it raises an error, the execution returns a
 * None, with the error value set accordingly.
 *
 * The callMaybe function can be used to conditionally skip execution of a
 * function if any of the arguments are a None. Normal values and Maybe values
 * can be intermixed -- any Some values are unwrapped before being passed.
 *
 * ## Basic Usage:
 *
 * ```ts
 * import {
 *  some, none, callMaybe, isMaybe, isSome, OptionalMaybe, Maybe,
 * } from '@opticss/util';
 * const LARGENESS_THRESHOLD = 100;
 * function getLargeNumber(n: number): Maybe<number> {
 *   if (number > LARGENESS_THRESHOLD) {
 *     return some(number);
 *   } else {
 *     return none(`number must be greater than ${LARGENESS_THRESHOLD}`);
 *   }
 * }
 *
 * function formatIfLargeNumber(n: number): Maybe<string> {
 *   let largeN = getLargeNumber(n);
 *   return callMaybe(formatNumber, largeN);
 * }
 *
 * let counter: number = 0;
 * function updateCounter(n: OptionalMaybe<number>) {
 *   if (isMaybe(n)) {
 *     if (isSome(n)) {
 *       counter += unwrap(n);
 *     }
 *   } else {
 *     number += n;
 *   }
 * }
 *
 * function formatNumber(n: number): string {
 *   return n.toString(16);
 * }
 * ```
 */
export type Maybe<T> = Some<T> | None;

export const MAYBE = Symbol("Maybe");
export const NO_VALUE = Symbol("None");
export interface None {
  [MAYBE]: symbol;
  error?: string | Error;
}
export interface Some<T> {
  [MAYBE]: T;
}
export type MaybeUndefined<T extends defined> = T | Maybe<T> | undefined;
export type OptionalMaybe<T> = T | Maybe<T>;

/**
 * Passes a Maybe through. If the value is not a Maybe, undefined and null are
 * converted to None, all other values are treated as Some. An error message
 * can be provided for the eventual call to none() if the value is nothing.
 */
export function maybe<T extends something>(v: MaybeUndefined<T>, error?: string): Maybe<T> {
  if (v === undefined || v === null) {
    return none(error);
  } else if (isMaybe(v)) {
    return v;
  } else {
    return some(v);
  }
}

/**
 * Creates a Some() value.
 */
export function some<T>(v: T): Some<T> {
  return {[MAYBE]: v};
}

/**
 * Creates a None() value.
 */
export function none(error?: string | Error): None {
  return {[MAYBE]: NO_VALUE, error};
}

export type CallMeMaybe0<R> = FunctionCall0<R>
                            | FunctionCall0<Maybe<R>>;
export type CallMeMaybe1<A1, R> = FunctionCall1<A1, R>
                                | FunctionCall1<A1, Maybe<R>>;
export type CallMeMaybe2<A1, A2, R> = FunctionCall2<A1, A2, R>
                                    | FunctionCall2<A1, A2, Maybe<R>>;
export type CallMeMaybe3<A1, A2, A3, R> = FunctionCall3<A1, A2, A3, R>
                                        | FunctionCall3<A1, A2, A3, Maybe<R>>;
export type CallMeMaybe4<A1, A2, A3, A4, R> = FunctionCall4<A1, A2, A3, A4, R>
                                            | FunctionCall4<A1, A2, A3, A4, Maybe<R>>;
export type CallMeMaybe<A1, A2, A3, A4, R> = CallMeMaybe0<R>
                                           | CallMeMaybe1<A1, R>
                                           | CallMeMaybe2<A1, A2, R>
                                           | CallMeMaybe3<A1, A2, A3, R>
                                           | CallMeMaybe4<A1, A2, A3, A4, R>;

export function callMaybe<A1, R>(fn: CallMeMaybe1<A1, R>, arg1: OptionalMaybe<A1>): Maybe<R>;
export function callMaybe<A1, A2, R>(fn: CallMeMaybe2<A1, A2, R>, arg1: OptionalMaybe<A1>, arg2: OptionalMaybe<A2>): Maybe<R>;
export function callMaybe<A1, A2, A3, R>(fn: CallMeMaybe3<A1, A2, A3, R>, arg1: OptionalMaybe<A1>, arg2: OptionalMaybe<A2>, arg3: OptionalMaybe<A3>): Maybe<R>;
export function callMaybe<A1, A2, A3, A4, R>(fn: CallMeMaybe4<A1, A2, A3, A4, R>, arg1: OptionalMaybe<A1>, arg2: OptionalMaybe<A2>, arg3: OptionalMaybe<A3>, arg4: OptionalMaybe<A4>): Maybe<R>;

/**
 * If any argument is a None, do not invoke the function and return the first argument that is a none instead.
 * If the function returns a maybe, pass it through. All other return values are returned as a Some.
 */
export function callMaybe<A1, A2, A3, A4, R>(fn: CallMeMaybe<A1, A2, A3, A4, R>, arg1: OptionalMaybe<A1>, arg2?: OptionalMaybe<A2>, arg3?: OptionalMaybe<A3>, arg4?: OptionalMaybe<A4>): Maybe<R> {
  if (isMaybe(arg1) && isNone(arg1)) { return arg1; }
  else if (isMaybe(arg2) && isNone(arg2)) { return arg2; }
  else if (isMaybe(arg3) && isNone(arg3)) { return arg3; }
  else if (isMaybe(arg4) && isNone(arg4)) { return arg4; }
  let rv: OptionalMaybe<R> = fn.call(null,
                                     arg1 && unwrapIfMaybe(arg1),
                                     arg2 && unwrapIfMaybe(arg2),
                                     arg3 && unwrapIfMaybe(arg3),
                                     arg4 && unwrapIfMaybe(arg4),
  );
  if (isMaybe(rv)) return rv;
  return maybe(rv);
}

export type HasMethod<Type extends object, N extends keyof Type, PropertyType> = Pick<{
  [P in keyof Type]: PropertyType;
}, N>;

export function methodMaybe<N extends keyof T, T extends HasMethod<T, N, CallMeMaybe0<R>>, R>(thisObj: Maybe<T>, fnName: N): Maybe<R>;
export function methodMaybe<N extends keyof T, T extends HasMethod<T, N, CallMeMaybe1<A1, R>>, A1, R>(thisObj: Maybe<T>, fnName: N, arg1: OptionalMaybe<A1>): Maybe<R>;
export function methodMaybe<N extends keyof T, T extends HasMethod<T, N, CallMeMaybe2<A1, A2, R>>, A1, A2, R>(thisObj: Maybe<T>, fnName: N, arg1: OptionalMaybe<A1>, arg2: OptionalMaybe<A2>): Maybe<R>;
export function methodMaybe<N extends keyof T, T extends HasMethod<T, N, CallMeMaybe3<A1, A2, A3, R>>, A1, A2, A3, R>(thisObj: Maybe<T>, fnName: N, arg1: OptionalMaybe<A1>, arg2: OptionalMaybe<A2>, arg3: OptionalMaybe<A3>): Maybe<R>;
export function methodMaybe<N extends keyof T, T extends HasMethod<T, N, CallMeMaybe4<A1, A2, A3, A4, R>>, A1, A2, A3, A4, R>(thisObj: Maybe<T>, fnName: N, arg1: OptionalMaybe<A1>, arg2: OptionalMaybe<A2>, arg3: OptionalMaybe<A3>, arg4: OptionalMaybe<A4>): Maybe<R>;
export function methodMaybe<
  N extends keyof T,
  T extends HasMethod<T, N, CallMeMaybe<A1, A2, A3, A4, R>>, A1, A2, A3, A4, R>(
  thisObj: Maybe<T>,
  fnName: N,
  arg1?: OptionalMaybe<A1>,
  arg2?: OptionalMaybe<A2>,
  arg3?: OptionalMaybe<A3>,
  arg4?: OptionalMaybe<A4>,

): Maybe<R> {
  if (isNone(thisObj)) return thisObj;
  if (isMaybe(arg1) && isNone(arg1)) { return arg1; }
  else if (isMaybe(arg2) && isNone(arg2)) { return arg2; }
  else if (isMaybe(arg3) && isNone(arg3)) { return arg3; }
  else if (isMaybe(arg4) && isNone(arg4)) { return arg4; }
  let self: T = unwrap(thisObj);
  let method: T[N] = self[fnName];
  let rv: OptionalMaybe<R> = method.call(self,
                                         arg1 && unwrapIfMaybe(arg1),
                                         arg2 && unwrapIfMaybe(arg2),
                                         arg3 && unwrapIfMaybe(arg3),
                                         arg4 && unwrapIfMaybe(arg4),
  );
  if (isMaybe(rv)) return rv;
  return some(rv);
}

/**
 * Runs the callback.
 *
 * If it returns a maybe, it is returned.
 * If it raises an error, a None is returned and the caught error is thrown
 *   when the value is unwrapped.
 * Otherwise the return value, is passed through `maybe()`
 *   returning a `Some` or `None` depending on the value.
 */
export function attempt<R>(fn: () => OptionalMaybe<R>): Maybe<R> {
  try {
    let rv = fn();
    if (isMaybe(rv)) return rv;
    return some(rv);
  } catch (e) {
    return none(e);
  }
}

/**
 * Type Guard. Test if the value is a Maybe (a Some or a None).
 */
export function isMaybe(value: whatever): value is Maybe<something> {
  if (isObject(value)) {
    return value.hasOwnProperty(MAYBE);
  } else {
    return false;
  }
}

/**
 * Check if an arbitrary value is a Some of a particular type as determined by
 * the provided type guard. Usually, you'll want to use `isSome` on a `Maybe`
 * of a statically determined type. But this is useful if you need to accept
 * a single value that is a `Maybe` of several types and you need to do some
 * control flow before unwrapping.
 */
export function isSomeOfType<T>(value: whatever, guard: TypeGuard<T>): value is Some<T> {
  if (isMaybe(value)) {
    if (isNone(value)) return false;
    return guard(unwrap(value));
  } else {
    return false;
  }
}

/**
 * Type Guard. Test if the value is a Some.
 */
export function isSome<T extends something>(value: Maybe<T>): value is Some<T> {
  return value[MAYBE] !== NO_VALUE;
}

/**
 * Type Guard. Test if the value is a None.
 */
export function isNone(value: whatever): value is None {
  return isObject(value) && value[MAYBE] === NO_VALUE;
}

/**
 * An error class that is raised when the error provided is just a string
 * message.
 */
export class UndefinedValue extends Error {
  constructor(message?: string) {
    super(message || "A value was expected.");
  }
}

/**
 * If the Maybe is a None, raise an error.
 * otherwise, return the value of the Maybe.
 */
export function unwrap<T>(value: Maybe<T>): T {
  if (isNone(value)) {
    if (value.error) {
      if (value.error instanceof Error) {
        throw value.error;
      } else {
        throw new UndefinedValue(value.error);
      }
    } else {
      throw new UndefinedValue();
    }
  } else {
    return value[MAYBE];
  }
}

/**
 * If the value passed is a maybe, unwrap it. otherwise pass the value through.
 */
export function unwrapIfMaybe<T>(value: OptionalMaybe<T>): T {
  if (isMaybe(value)) {
    return unwrap(value);
  } else {
    return value;
  }
}

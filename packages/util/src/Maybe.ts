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
export type something = string | number | boolean | symbol | object;
export type defined = something | null;

// export const MAYBE = Symbol("Maybe");
export const NO_VALUE = Symbol("None");
export type Maybe<T> = Some<T> | None;
export type None = { maybe: symbol, error?: string | Error };
export type Some<T> = { maybe: T };
export type MaybeUndefined<T extends defined> = T | Maybe<T> | undefined;
export type OptionalMaybe<T> = T | Maybe<T>;

/**
 * Passes a Maybe through. If the value is not a Maybe, undefined is converted
 * to None, all other values are treated as Some. An error message can be
 * provided for the eventual call to none() if the value is undefined.
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
  return {maybe: v};
}

/**
 * Creates a None() value.
 */
export function none(error?: string | Error): None {
  return {maybe: NO_VALUE, error};
}

export type FunctionCall1<A1, R> = (arg1: A1) => R;
export type FunctionCall2<A1, A2, R> = (arg1: A1, arg2: A2) => R;
export type FunctionCall3<A1, A2, A3, R> = (arg1: A1, arg2: A2, arg3: A3) => R;
export type FunctionCall4<A1, A2, A3, A4, R> = (arg1: A1, arg2: A2, arg3: A3, arg4: A4) => R;
export type CallMeMaybe1<A1, R> = FunctionCall1<A1, R>
                                | FunctionCall1<A1, Maybe<R>>;
export type CallMeMaybe2<A1, A2, R> = FunctionCall2<A1, A2, R>
                                    | FunctionCall2<A1, A2, Maybe<R>>;
export type CallMeMaybe3<A1, A2, A3, R> = FunctionCall3<A1, A2, A3, R>
                                        | FunctionCall3<A1, A2, A3, Maybe<R>>;
export type CallMeMaybe4<A1, A2, A3, A4, R> = FunctionCall4<A1, A2, A3, A4, R>
                                            | FunctionCall4<A1, A2, A3, A4, Maybe<R>>;
export type CallMeMaybe<A1, A2, A3, A4, R> = CallMeMaybe1<A1, R>
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
  if (isNone(arg1)) { return arg1; }
  else if (isNone(arg2)) { return arg2; }
  else if (isNone(arg3)) { return arg3; }
  else if (isNone(arg4)) { return arg4; }
  let rv: OptionalMaybe<R> = fn.call(null,
    unwrapIfMaybe(arg1),
    arg2 && unwrapIfMaybe(arg2),
    arg3 && unwrapIfMaybe(arg3),
    arg4 && unwrapIfMaybe(arg4)
  );
  if (isMaybe(rv)) return rv;
  return some(rv);
}

/**
 * run the callback, if it returns a maybe, pass it through.
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
export function isMaybe<T extends something>(value: any): value is Maybe<T> {
  if (value === null || value === undefined) return false;
  return value.hasOwnProperty('maybe');
}

/**
 * Type Guard. Test if the value is a Some.
 */
export function isSome<T extends something>(value: any): value is Some<T> {
  if (value === null || value === undefined) return false;
  return value['maybe'] !== NO_VALUE && isMaybe(value);
}

/**
 * Type Guard. Test if the value is a None.
 */
export function isNone(value: any): value is None {
  if (value === null || value === undefined) return false;
  return value['maybe'] === NO_VALUE;
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
    return value['maybe'];
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

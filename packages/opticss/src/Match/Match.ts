import { assertNever } from "@opticss/util";

export enum Match {
  /**
   * The element will definitively match the selector or selector component in
   * at least dynamic one state.
   */
  yes = 1,
  /**
   * The element may match the selector or selector component; information is
   * ambiguous.
   */
  maybe,
  /** The element will not match the selector or selector component. */
  no,
  /**
   * The element is unrelated to the selector or selector component and no
   * information about whether the element matches can be determined.
   */
  pass,
}

/**
 * true => Match.yes
 * false => Match.no
 * null => Match.pass
 * undefined => Match.maybe
 */
export function boolToMatch(value: boolean | null | undefined): Match {
  if (value === true) {
    return Match.yes;
  } else if (value === false) {
    return Match.no;
  } else if (value === undefined) {
    return Match.maybe;
  } else {
    return Match.pass;
  }
}

export function matchToBool(match: Match): boolean | null | undefined {
  switch (match) {
    case Match.yes:
      return true;
    case Match.no:
      return false;
    case Match.maybe:
      return undefined;
    case Match.pass:
      return null;
    default:
      return assertNever(match);
  }
}

export function matches(m: Match): boolean {
  return m === Match.yes || m === Match.maybe;
}

export function rejects(m: Match): boolean {
  return m === Match.no;
}

export function negate(m: Match): Match {
  if (matches(m)) {
    return Match.no;
  } else if (rejects(m)) {
    return Match.yes;
  } else {
    return m;
  }
}

const FIRST_CHAR = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const OTHER_CHAR = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";

const FIRST_CHAR_INSENSITIVE = "abcdefghijklmnopqrstuvwxyz";
const OTHER_CHAR_INSENSITIVE = "0123456789abcdefghijklmnopqrstuvwxyz-_";

function identChar(insensitive: boolean, c: number, i: number): string {
  return i === 0
    ? (insensitive ? FIRST_CHAR_INSENSITIVE : FIRST_CHAR)[c]
    : (insensitive ? OTHER_CHAR_INSENSITIVE : OTHER_CHAR)[c];
}

function increment(insensitive: boolean, counters: Array<number>, i: number) {
  let c = counters[i] + 1;
  let carry = false;
  if (i === 0 && c === (insensitive ? 26 : 52)) {
    c = 0;
    carry = true;
  } else if (i > 0 && c === (insensitive ? 38 : 64)) {
    c = 0;
    carry = true;
  }
  counters[i] = c;
  return carry;
}

function countersForInteger(caseInsensitive: boolean, integer: number): Array<number> {
  integer = Math.round(integer);
  let firstDigitBase = caseInsensitive ? 26 : 52;
  let otherDigitBase = caseInsensitive ? 38 : 64;
  let numDigits = 0;
  let maxNumber = 0;
  let penultimateMax = 0;
  // We need to know the maximum number for one less than the number of places
  // in our high-base number; numbers above that can be converted using the
  // standard base-conversion algorithm in the base of the non-first digits.
  // (These maximums are only dependent on the number of places so in theory
  // this could be replaced with a lookup table.)
  while (integer > maxNumber) {
    penultimateMax = maxNumber;
    numDigits++;
    maxNumber += firstDigitBase * Math.pow(otherDigitBase, numDigits - 1);
  }
  let counters = new Array(numDigits);
  // tbh I don't understand why we have to subtract an extra 1 here.
  // I think it's because our leading digit has no zero.
  integer -= penultimateMax + 1;
  for (let c = 0; c < numDigits; c++) {
    // Because we've subtracted penultimateMax, counters[0] is actually 1 less
    // than the number it should be. But we don't have to add 1 to our leading
    // digit because the base of our leading digit doesn't have a "zero".
    counters[numDigits - c - 1] = (integer % otherDigitBase);
    integer = Math.floor(integer / otherDigitBase);
  }
  return counters;
}

function integerForCounters(counters: Array<number>, caseInsensitive: boolean): number {
  let firstDigitBase = caseInsensitive ? 26 : 52;
  let otherDigitBase = caseInsensitive ? 38 : 64;
  let total = 0;
  // We first calculate this like our leading digit has the same base as the other digits.
  for (let i = 0; i < counters.length; i++) {
    total += (counters[i] + (i === 0 ? 1 : 0)) * Math.pow(otherDigitBase, counters.length - i - 1);
  }
  // Then we subtract the numeric gaps at the digit boundaries.
  // (This only varies by the number of digits in our number so in theory it
  // could be replaced by a lookup table.)
  for (let i = 0; i < counters.length - 1; i++) {
    total -= (otherDigitBase - firstDigitBase - 1) * Math.pow(otherDigitBase, i);
  }
  return total;
}

export class IdentGenerator {
  private caseInsensitive: boolean;
  lastIdent: string;
  private maxIdentCount: number;
  private startValue: number;
  returnedIdents: Array<string>;
  reservedIdents: Set<string>;
  private counters: Array<number>;
  private identChar: (c: number, i: number) => string;
  private increment: (counters: Array<number>, i: number) => boolean;
  constructor(caseInsensitive = false, startValue = 1, maxIdentCount = Infinity) {
    if (startValue < 1) {
      throw new RangeError("startValue must be at least 1");
    }
    this.caseInsensitive = caseInsensitive;
    this.startValue = startValue;
    this.maxIdentCount = maxIdentCount;
    this.counters = countersForInteger(caseInsensitive, startValue);
    this.returnedIdents = [];
    this.reservedIdents = new Set();
    this.identChar = identChar.bind(null, caseInsensitive);
    this.increment = increment.bind(null, caseInsensitive);
  }

  get currentValue(): number {
    return integerForCounters(this.counters, this.caseInsensitive);
  }

  nextIdent(): string {
    if (this.returnedIdents.length > 0) {
      return this.returnedIdents.pop()!;
    }
    let ident: string;
    while (this.isReserved(ident = this.generateNextIdent())) {}
    if (this.maxIdentCount !== Infinity) {
      let identCount = this.currentValue - this.startValue;
      if (identCount > this.maxIdentCount) {
        throw new Error(`Too many identifiers were generated (Max: ${this.maxIdentCount}).`);
      }
    }
    return this.lastIdent = ident;
  }
  private generateNextIdent() {
    let nextIdent = this.counters.map(this.identChar).join("");
    let carry = false;
    for (let i = this.counters.length - 1; i >= 0; i--) {
      carry = this.increment(this.counters, i);
      if (!carry) { break; }
    }
    if (carry) this.counters.push(0);
    return nextIdent;
  }

  /** An iterator that produces an infinite sequence of identifiers. */
  *idents() {
    yield this.nextIdent();
  }

  /**
   * When a generated ident is no longer in use, it should be returned
   * so it can be re-used.
   */
  returnIdent(ident: string): void {
    this.returnedIdents.push(ident);
  }

  reserve(...idents: string[]): void {
    for (let ident of idents) {
      this.reservedIdents.add(ident);
    }
  }

  isReserved(ident: string): boolean {
    return this.reservedIdents.has(ident);
  }
}

interface IdentGeneratorOptions<Namespace extends string = string> {
  namespaces: Array<Namespace>;
  /**
   * Whether to use case-insensitive identifiers.
   */
  caseInsensitive?: boolean;
  /**
   * Sets the starting value. This is a standard base-10 number that is
   * converted to a corresponding identifier.
   *
   * An integer greater than or equal to 1.
   * Defaults to 1.
   */
  startValue?: number;
  /**
   * How many identifiers each ident generator should be allowed to produce.
   * Note that if any of the produced identifiers are reserved, the actual
   * number of identifiers returned will be less than the max.
   * Defaults to Infinity.
   */
  maxIdentCount?: number;
}

export class IdentGenerators<Namespace extends string = string> {
  namespaces: {
    [name: string]: IdentGenerator;
  };
  constructor(options: IdentGeneratorOptions<Namespace>) {
    this.namespaces = {};
    options.namespaces.forEach(ns => {
      this.namespaces[ns] = new IdentGenerator(!!options.caseInsensitive,
                                               options.startValue || 1,
                                               options.maxIdentCount || Infinity);
    });
  }
  /**
   * Look up the ident generator for the given namespace. Raise an error if no
   * no such namespace exists.
   */
  get(namespace: Namespace): IdentGenerator {
    let generator = this.namespaces[namespace];
    if (generator) {
      return generator;
    } else {
      throw new Error("unknown ident namespace: " + namespace);
    }
  }
  /**
   * Generate an ident from the given namespace.
   */
  nextIdent(namespace: Namespace) {
    return this.get(namespace).nextIdent();
  }
  /**
   * Return an ident to be generated for the next requested ident.
   */
  returnIdent(namespace: Namespace, ident: string) {
    this.get(namespace).returnIdent(ident);
  }
  /**
   * Reserved idents are never output by the ident generator.
   * @param namespace The namespace that ident should come from.
   * @param idents The ident that should not be generated.
   */
  reserve(namespace: Namespace, ...idents: string[]) {
    this.get(namespace).reserve(...idents);
  }
}

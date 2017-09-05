const FIRST_CHAR = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const OTHER_CHAR = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';

function identChar(c: number, i: number) {
  return i === 0 ? FIRST_CHAR[c] : OTHER_CHAR[c];
}

function increment(counters: Array<number>, i: number) {
  let c = counters[i] + 1;
  let carry = false;
  if (i === 0 && c === 52) {
    c = 0;
    carry = true;
  } else if (i > 0 && c === 64) {
    c = 0;
    carry = true;
  }
  counters[i] = c;
  return carry;
}

export class IdentGenerator {
  lastIdent: string;
  private counters: Array<number>;
  constructor() {
    this.counters = [0];
  }
  nextIdent(): string {
    this.lastIdent = this.counters.map(identChar).join("");
    let carry = false;
    for (let i = this.counters.length - 1; i >= 0; i--) {
      carry = increment(this.counters, i);
      if (!carry) { break; }
    }
    if (carry) this.counters.push(0);
    return this.lastIdent;
  }
}
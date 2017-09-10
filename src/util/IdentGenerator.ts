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
  returnedIdents: Array<string>;
  private counters: Array<number>;
  constructor() {
    this.counters = [0];
    this.returnedIdents = [];
  }
  nextIdent(): string {
    if (this.returnedIdents.length > 0) {
      return this.returnedIdents.pop()!;
    }
    this.lastIdent = this.counters.map(identChar).join("");
    let carry = false;
    for (let i = this.counters.length - 1; i >= 0; i--) {
      carry = increment(this.counters, i);
      if (!carry) { break; }
    }
    if (carry) this.counters.push(0);
    return this.lastIdent;
  }
  /**
   * When a generated ident is no longer in use, it should be returned
   * so it can be re-used.
   */
  returnIdent(ident: string) {
    this.returnedIdents.push(ident);
  }
}

export class IdentGenerators<Namespace extends string = string> {
  namespaces: {
    [name: string]: IdentGenerator;
  };
  constructor(...namespaces: Array<Namespace>) {
    this.namespaces = {};
    namespaces.forEach(ns => {
      this.namespaces[ns] = new IdentGenerator();
    });
  }
  get(namespace: Namespace): IdentGenerator {
    let generator = this.namespaces[namespace];
    if (generator) {
      return generator;
    } else {
      throw new Error("unknown ident namespace: " + namespace);
    }
  }
  nextIdent(namespace: Namespace) {
    return this.get(namespace).nextIdent();
  }
  returnIdent(namespace: Namespace, ident: string) {
    this.get(namespace).returnIdent(ident);
  }
}
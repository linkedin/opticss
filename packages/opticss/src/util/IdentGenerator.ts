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
  reservedIdents: Set<string>;
  private counters: Array<number>;
  constructor() {
    this.counters = [0];
    this.returnedIdents = [];
    this.reservedIdents = new Set();
  }
  nextIdent(): string {
    if (this.returnedIdents.length > 0) {
      return this.returnedIdents.pop()!;
    }
    let ident: string;
    while (this.isReserved(ident = this.generateNextIdent())) {}
    return this.lastIdent = ident;
  }
  private generateNextIdent() {
    let nextIdent = this.counters.map(identChar).join("");
    let carry = false;
    for (let i = this.counters.length - 1; i >= 0; i--) {
      carry = increment(this.counters, i);
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
import * as postcss from "postcss";
import * as selectorParser from "postcss-selector-parser";
import { Action } from "./Action";
import { SourcePosition } from "../SourceLocation";
import { SelectorCache } from "../query";
import { IdentGenerator } from "../util/IdentGenerator";
import { ParsedSelector, isClass, isIdentifier } from "../parseSelector";
import { StyleMapping } from "../StyleMapping";

export type IdentNode = selectorParser.Identifier | selectorParser.ClassName;

export interface RuleIdents {
  rule: postcss.Rule;
  selectors: ParsedSelector[];
  idents: IdentNode[];
}

export interface IdentGenerators {
  id: IdentGenerator;
  class: IdentGenerator;
}

export interface KnownIdents {
  id: Set<string>;
  class: Set<string>;
}

/**
 * Changes a Rule's selector's idents to make them more compressible.
 */
export class RewriteRuleIdents extends Action {
  newSelector: string;
  oldSelector: string | undefined;
  cache: SelectorCache;
  generators: IdentGenerators;
  ident: RuleIdents;
  knownIdents: KnownIdents;
  styleMapping: StyleMapping;

  constructor(
    styleMapping: StyleMapping,
    ident: RuleIdents,
    knownIdents: KnownIdents,
    generators: IdentGenerators,
    cache: SelectorCache,
    reason = "rewriteIdents")
  {
    super(reason);
    this.styleMapping = styleMapping;
    this.ident = ident;
    this.knownIdents = knownIdents;
    this.generators = generators;
    this.cache = cache;
    this.oldSelector = undefined;
  }
  get sourcePosition(): SourcePosition | undefined {
    if (this.ident.rule && this.ident.rule.source && this.ident.rule.source.start) {
      return {
        filename: this.ident.rule.source.input.file,
        line: this.ident.rule.source.start.line,
        column: this.ident.rule.source.start.column
      };
    } else {
      return undefined;
    }
  }
  perform(): this {
    this.cache.reset(this.ident.rule);
    this.oldSelector = this.ident.rule.selector;
    this.ident.idents.forEach(node => {
      if (isClass(node)) {
        this.rewriteNode("class", node);
      } else if (isIdentifier(node)) {
        this.rewriteNode("id", node);
      }
    });
    this.newSelector = this.ident.selectors.join(", ");
    this.ident.rule.selector = this.newSelector;
    return this;
  }

  rewriteNode(type: keyof KnownIdents, node: selectorParser.ClassName | selectorParser.Identifier) {
    let oldValue = node.value;
    let fromAttr = { name: type, value: oldValue };
    let toAttr = this.styleMapping.getRewriteOf(fromAttr);
    if (!toAttr) {
      toAttr = {
        name: type,
        value: this.nextIdent(type)
      };
      this.styleMapping.rewriteAttribute(fromAttr, toAttr);
    }
    node.value = toAttr.value;
  }

  logString(): string {
    return this.annotateLogMessage(`Rewrote selector's idents from "${this.oldSelector}" to "${this.newSelector}".`);
  }

  // TODO use analyses to exclude generated idents
  private nextIdent(
    type: keyof KnownIdents
  ): string {
    let generator = this.generators[type];
    let known = this.knownIdents[type];
    let nextId = generator.nextIdent();
    while (known.has(nextId)) {
      nextId = generator.nextIdent();
    }
    return nextId;
  }
}
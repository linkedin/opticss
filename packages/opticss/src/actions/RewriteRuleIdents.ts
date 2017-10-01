import * as postcss from "postcss";
import * as selectorParser from "postcss-selector-parser";
import { Action, stripNL } from "./Action";
import { SourcePosition } from "@opticss/template-api";
import { ParsedSelector, isClass, isIdentifier } from "../parseSelector";
import { OptimizationPass } from "../OptimizationPass";
import { IdentNode } from "../optimizations/util";

export interface RuleIdents {
  rule: postcss.Rule;
  selectors: ParsedSelector[];
  idents: IdentNode[];
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
  ident: RuleIdents;
  knownIdents: KnownIdents;
  pass: OptimizationPass;

  constructor(
    pass: OptimizationPass,
    ident: RuleIdents,
    reason = "rewriteIdents")
  {
    super(reason);
    this.pass = pass;
    this.ident = ident;
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
    this.pass.cache.reset(this.ident.rule);
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
    let toAttr = this.pass.styleMapping.getRewriteOf(fromAttr);
    if (!toAttr) {
      toAttr = {
        name: type,
        value: this.pass.identGenerators.nextIdent(type)
      };
      this.pass.styleMapping.rewriteAttribute(fromAttr, toAttr);
    }
    node.value = toAttr.value;
  }

  logString(): string {
    return this.annotateLogMessage(`Rewrote selector's idents from "${stripNL(this.oldSelector!)}" to "${stripNL(this.newSelector)}".`);
  }

  // TODO use analyses to exclude generated idents
}
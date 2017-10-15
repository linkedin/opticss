import * as postcss from "postcss";
import { Action, stripNL } from "../Action";
import { SourcePosition } from "@opticss/template-api";
import { Optimizations } from "../../OpticssOptions";
import { SelectorCache } from "../../query";

/**
 * Removes a Rule.
 * Keeps track of the parent to which it belonged and the prev sibling.
 */
export class RemoveRule extends Action {
  reason: string;
  parent: postcss.Container;
  prevSibling: postcss.Node | undefined;
  rule: postcss.Rule;
  cache: SelectorCache;
  constructor(rule: postcss.Rule, optimization: keyof Optimizations, reason: string, cache: SelectorCache) {
    super(optimization);
    this.reason = reason;
    this.parent = rule.parent;
    this.prevSibling = rule.prev() || undefined;
    this.rule = rule;
    this.cache = cache;
  }
  perform(): this {
    this.cache.reset(this.rule);
    this.rule.remove();
    return this;
  }
  get oldSelector() {
    return this.rule.selector;
  }
  logString(): string {
    return this.annotateLogMessage(`Removed rule with selector "${stripNL(this.oldSelector)}" because ${this.reason}.`);
  }
  get sourcePosition(): SourcePosition | undefined {
    if (this.rule.source && this.rule.source.start) {
      return {
        filename: this.rule.source.input.file,
        line: this.rule.source.start.line,
        column: this.rule.source.start.column
      };
    } else {
      return undefined;
    }
  }
}
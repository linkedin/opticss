import * as postcss from "postcss";
import { Action } from "./Action";
import { SourcePosition } from "../SourceLocation";
import { Optimizations } from "../OpticssOptions";
import { SelectorCache } from "../query";

/**
 * Removes a Rule.
 * Keeps track of the parent to which it belonged and the prev sibling.
 */
export class RemoveRule extends Action {
  parent: postcss.Container;
  prevSibling: postcss.Node | undefined;
  rule: postcss.Rule;
  cache: SelectorCache;
  constructor(rule: postcss.Rule, reason: keyof Optimizations, cache: SelectorCache) {
    super(reason);
    this.parent = rule.parent;
    this.prevSibling = rule.prev();
    this.rule = rule;
    this.cache = cache;
  }
  perform(): this {
    this.cache.reset(this.rule);
    this.rule.remove();
    return this;
  }
  logString(): string {
    return this.annotateLogMessage(`Removed rule with selector "${this.rule.selector}".`);
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
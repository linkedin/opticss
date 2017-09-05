import * as postcss from "postcss";
import { Action } from "./Action";
import { SourcePosition } from "../SourceLocation";
import { Optimizations } from "../OpticssOptions";
import { SelectorCache } from "../query";

/**
 * Changes a Rule's selector string.
 */
export class ChangeSelector extends Action {
  rule: postcss.Rule;
  oldSelector: string;
  newSelector: string;
  cache: SelectorCache;
  constructor(rule: postcss.Rule, newSelector: string, reason: keyof Optimizations, cache: SelectorCache) {
    super(reason);
    this.rule = rule;
    this.oldSelector = rule.selector;
    this.newSelector = newSelector;
    this.cache = cache;
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
  perform(): this {
    this.cache.reset(this.rule);
    this.rule.selector = this.newSelector;
    return this;
  }
  logString(): string {
    return this.annotateLogMessage(`Changed selector from "${this.oldSelector}" to "${this.newSelector}".`);
  }
}
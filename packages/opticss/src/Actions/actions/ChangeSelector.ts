import { SourcePosition } from "@opticss/element-analysis";
import * as postcss from "postcss";

import { Optimizations } from "../../OpticssOptions";
import { SelectorCache } from "../../query";
import { Action, stripNL } from "../Action";

/**
 * Changes a Rule's selector string.
 */
export class ChangeSelector extends Action {
  reason: string;
  rule: postcss.Rule;
  oldSelector: string;
  newSelector: string;
  cache: SelectorCache;
  constructor(rule: postcss.Rule, newSelector: string, optimization: keyof Optimizations, reason: string, cache: SelectorCache) {
    super(optimization);
    this.reason = reason;
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
        column: this.rule.source.start.column,
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
    return this.annotateLogMessage(`Changed selector from "${stripNL(this.oldSelector)}" to "${stripNL(this.newSelector)}" because ${this.reason}.`);
  }
}

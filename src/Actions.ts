import * as postcss from "postcss";
import { SelectorCache } from "./query";
import { SourcePosition } from "./SourceLocation";
import { Optimizations } from "./OpticssOptions";

/**
 * Represents an action that can be performed by the optimizer.
 * All optimizations must be done as an action. This provides
 * a central point for creating logs and reports of the work
 * that was done. It can also be used to implement backtracking.
 */
export abstract class Action {
  optimization: string;
  abstract perform(): this;
  abstract logString(): string;
  abstract readonly sourcePosition: SourcePosition | undefined;
  constructor(reason: keyof Optimizations) {
    this.optimization = reason;
  }
  annotateLogMessage(message: string) {
    if (this.sourcePosition) {
      let prefix = "";
      if (this.sourcePosition.filename) {
        prefix += this.sourcePosition.filename + ":";
      }
      prefix += this.sourcePosition.line;
      if (this.sourcePosition.column) {
        prefix += ":" + this.sourcePosition.column;
      }
      return `${prefix} [${this.optimization}] ${message}`;
    } else {
      return message;
    }
  }
}

/**
 * Tracks the actions that were performed and the order in which they were done.
 */
export class Actions {
  performed: Array<Action>;
  constructor() {
    this.performed = [];
  }
  perform(action: Action) {
    this.performed.push(action.perform());
  }
}

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
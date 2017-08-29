import * as postcss from "postcss";
import { SelectorCache } from "./query";

/**
 * Represents an action that can be performed by the optimizer.
 * All optimizations must be done as an action. This provides
 * a central point for creating logs and reports of the work
 * that was done. It can also be used to implement backtracking.
 */
export abstract class Action {
  abstract perform(): this;
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
  constructor(rule: postcss.Rule, newSelector: string, cache: SelectorCache) {
    super();
    this.rule = rule;
    this.oldSelector = rule.selector;
    this.newSelector = newSelector;
    this.cache = cache;
  }
  perform(): this {
    this.cache.reset(this.rule);
    this.rule.selector = this.newSelector;
    return this;
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
  constructor(rule: postcss.Rule, cache: SelectorCache) {
    super();
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
}

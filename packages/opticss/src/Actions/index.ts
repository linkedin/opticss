import { Action } from "./Action";

/**
 * Tracks the actions that were performed and the order in which they were done.
 */
export default class Actions {
  performed: Array<Action>;
  constructor() {
    this.performed = [];
  }
  perform(action: Action) {
    this.performed.push(action.perform());
  }
  // TODO: Add undo method.
}

// All possible actions
export { AnnotateMergeConflict } from "./actions/AnnotateMergeConflict";
export { ChangeSelector } from "./actions/ChangeSelector";
export { ExpandShorthand } from "./actions/ExpandShorthand";
export { MarkAttributeValueObsolete } from "./actions/MarkAttributeValueObsolete";
export { RemoveRule } from "./actions/RemoveRule";
export { RewriteRuleIdents } from "./actions/RewriteRuleIdents";
export { MergeDeclarations } from "./actions/MergeDeclarations";
import { Action } from "./Action";

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
  logStrings(): Array<string> {
    return this.performed.map(a => a.logString());
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
export { Note } from "./actions/Note";
export * from "./Action";

import { Action } from "./actions/Action";

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
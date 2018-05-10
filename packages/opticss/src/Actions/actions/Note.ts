import { SourcePosition } from "../../../../@opticss/element-analysis/src";

import { Optimizations } from "../../OpticssOptions";
import { Action } from "../Action";

/**
 * Make a note about something discovered during optimization.
 */
export class Note extends Action {
  private _position: SourcePosition | undefined;
  reason: string;
  constructor(optimization: keyof Optimizations, reason: string, position?: SourcePosition) {
    super(optimization);
    this.reason = reason;
    this._position = position;
  }

  get sourcePosition(): SourcePosition | undefined {
    return this._position;
  }

  perform(): this {
    return this;
  }

  logString(): string {
    return this.annotateLogMessage(this.reason);
  }
}

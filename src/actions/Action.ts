/**
 * Represents an action that can be performed by the optimizer.
 * All optimizations must be done as an action. This provides
 * a central point for creating logs and reports of the work
 * that was done. It can also be used to implement backtracking.
 */
import { SourcePosition } from "../SourceLocation";
import { Optimizations } from "../optimizations";

export abstract class Action {
  optimization: string;
  abstract perform(): this;
  abstract logString(): string;
  abstract readonly sourcePosition: SourcePosition | undefined;
  constructor(optimization: keyof Optimizations) {
    this.optimization = optimization;
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

export function stripNL(str: string): string {
  return str.replace(/[\r\n\s]+/gm, " ");
}
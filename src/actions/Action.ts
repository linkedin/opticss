/**
 * Represents an action that can be performed by the optimizer.
 * All optimizations must be done as an action. This provides
 * a central point for creating logs and reports of the work
 * that was done. It can also be used to implement backtracking.
 */
import { SourcePosition } from "../SourceLocation";
import { Optimizations } from "../optimizations";
import * as postcss from "postcss";

export abstract class Action {
  optimization: string;
  abstract perform(): this;
  abstract logString(): string;
  abstract readonly sourcePosition: SourcePosition | undefined;
  constructor(optimization: keyof Optimizations) {
    this.optimization = optimization;
  }
  annotateLogMessage(message: string, sourcePosition = this.sourcePosition) {
    if (sourcePosition) {
      let prefix = "";
      if (sourcePosition.filename) {
        prefix += sourcePosition.filename + ":";
      }
      prefix += sourcePosition.line;
      if (sourcePosition.column) {
        prefix += ":" + sourcePosition.column;
      }
      return `${prefix} [${this.optimization}] ${message}`;
    } else {
      return message;
    }
  }

  nodeSourcePosition(node: postcss.Node) {
    if (node.source && node.source.start) {
      return {
        filename: node.source.input.file,
        line: node.source.start.line,
        column: node.source.start.column
      };
    } else {
      return undefined;
    }
  }
}

export abstract class MultiAction extends Action{
  logString(): string {
    return this.logStrings().join("\n");
  }
  abstract logStrings(): Array<string>;
}

export function stripNL(str: string): string {
  return str.replace(/[\r\n\s]+/gm, " ");
}
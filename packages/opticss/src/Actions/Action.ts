/**
 * Represents an action that can be performed by the optimizer.
 * All optimizations must be done as an action. This provides
 * a central point for creating logs and reports of the work
 * that was done. It can also be used to implement backtracking.
 */
import { SourcePosition } from "@opticss/template-api";
import { Optimizations } from "../optimizations";
import * as postcss from "postcss";

export abstract class Action {
  optimization: string;
  abstract perform(): this;
  abstract logString(): string;
  abstract readonly sourcePosition: SourcePosition | undefined | null;

  constructor(optimization: keyof Optimizations) {
    this.optimization = optimization;
  }

  positionString(sourcePosition = this.sourcePosition, includeFilename = true): string {
    let posStr = "";
    if (sourcePosition && sourcePosition.line > 0) {
      if (includeFilename && sourcePosition.filename) {
        posStr += sourcePosition.filename + ":";
      }
      posStr += sourcePosition.line;
      if (sourcePosition.column) {
        posStr += ":" + sourcePosition.column;
      }
    }
    return posStr;
  }

  annotateLogMessage(message: string, sourcePosition?: SourcePosition | null, indent = 0): string {
    if (sourcePosition === undefined) {
      sourcePosition = this.sourcePosition;
    }
    let annotated = "";
    if (sourcePosition) {
      annotated += this.positionString(sourcePosition) + " ";
    }
    let indentation = "";
    for (let i = 0; i < indent; i++) {
      indentation += "  ";
    }
    annotated += `[${this.optimization}] ${indentation}${message}`;
    return annotated;
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
import * as postcss from "postcss";
import { Action } from "../Action";
import { SourcePosition } from "@opticss/template-api";
import { Optimizations } from "../../OpticssOptions";
import { ParsedSelector } from "../../parseSelector";

export interface Declaration {
  prop: string;
  value: string;
  important: boolean;
}

export interface DeclarationInfo {
  selector: ParsedSelector;
  decl: postcss.Declaration;
}

/**
 * Merges duplicate declarations from multiple rule sets into a new rule set.
 */
export class ExpandShorthand extends Action {
  decl: postcss.Declaration;
  rule: postcss.Rule;
  decls: Array<Declaration>;
  newDecls: Array<postcss.Declaration>;
  reason: string;
  constructor(
    decl: postcss.Declaration,
    decls: Array<Declaration>,
    optimization: keyof Optimizations,
    reason: string
  ) {
    super(optimization);
    this.reason = reason;
    this.decl = decl;
    this.rule = <postcss.Rule>decl.parent;
    this.decls = decls;
    this.newDecls = [];
  }

  perform(): this {
    for (let decl of this.decls) {
      let declNode = postcss.decl(decl);
      declNode.raws = { before:' ', after: ' '};
      this.rule.insertBefore(this.decl, declNode);
      let newDecl = <postcss.Declaration>this.decl.prev();
      this.newDecls.push(newDecl);
    }
    return this;
  }

  logString(): string {
    return this.annotateLogMessage(`Expanded ${declString(this.decl)} into ${this.newDecls.map(d => declString(d)).join(" ")}. ${this.reason}`);
  }

  get sourcePosition(): SourcePosition | undefined {
    return this.nodeSourcePosition(this.decl);
  }
}

function declString(decl: Declaration): string {
  return `${decl.prop}: ${decl.value}${decl.important ? " !important": ""};`;
}

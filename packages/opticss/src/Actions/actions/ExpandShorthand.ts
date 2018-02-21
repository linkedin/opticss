import { SourcePosition } from "@opticss/element-analysis";
import * as postcss from "postcss";

import { Optimizations } from "../../OpticssOptions";
import { DeclarationInfo } from "../../optimizations/MergeDeclarations/StyleInfo";
import { Action } from "../Action";

/**
 * Merges duplicate declarations from multiple rule sets into a new rule set.
 */
export class ExpandShorthand extends Action {
  decl: postcss.Declaration;
  rule: postcss.Rule;
  decls: Array<DeclarationInfo>;
  newDecls: Array<postcss.Declaration>;
  reason: string;
  constructor(
    decl: postcss.Declaration,
    decls: Array<DeclarationInfo>,
    optimization: keyof Optimizations,
    reason: string,
  ) {
    super(optimization);
    this.reason = reason;
    this.decl = decl;
    this.rule = <postcss.Rule>decl.parent;
    this.decls = decls;
    this.newDecls = [];
  }

  perform(): this {
    let expanded = new Set<string>();
    for (let decl of this.decls) {
      decl.expanded = true;
      if (expanded.has(decl.prop)) continue;
      expanded.add(decl.prop);
      let declNode = postcss.decl(decl);
      declNode.raws = { before: " ", after: " "};
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

function declString(decl: {prop: string; value: string; important: boolean}): string {
  return `${decl.prop}: ${decl.value}${decl.important ? " !important" : ""};`;
}

import * as postcss from "postcss";
import { MultiAction } from "./Action";
import { SourcePosition } from "../SourceLocation";
import { Optimizations } from "../OpticssOptions";
import { SelectorCache } from "../query";
import { ParsedSelector } from "../parseSelector";
import { OptimizationPass } from "../Optimizer";
import { IdentGenerators } from "../util/IdentGenerator";

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
export class MergeDeclarations extends MultiAction {
  originalDecls: DeclarationInfo[];
  decl: Declaration;
  newRule: postcss.Rule;
  identGenerators: IdentGenerators<"id" | "class">;
  container: postcss.Container;
  reason: string;
  cache: SelectorCache;
  constructor(
    pass: OptimizationPass,
    container: postcss.Container,
    decl: Declaration,
    originalDecls: Array<DeclarationInfo>,
    optimization: keyof Optimizations,
    reason: string
  ) {
    super(optimization);
    this.reason = reason;
    this.container = container;
    this.cache = pass.cache;
    this.identGenerators = pass.identGenerators;
    this.decl = decl;
    this.originalDecls = originalDecls;
  }

  perform(): this {
    let classname = this.identGenerators.nextIdent("class");
    this.newRule = postcss.rule({selector: `.${classname}`});
    let decl = postcss.decl(this.decl);
    this.newRule.append(decl);
    if (this.container.append === undefined) {
      console.log("asdf");
    }
    this.container.append(this.newRule);
    for (let orig of this.originalDecls) {
      orig.decl.remove();
    }
    return this;
  }

  logStrings(): Array<string> {
    let logs = new Array<string>();
    let msg = `Declaration moved into generated rule (${this.declString()}). ${this.reason}`;
    for (let orig of this.originalDecls) {
      logs.push(this.annotateLogMessage(msg, this.declSourcePosition(orig.decl)));
    }
    return logs;
  }

  declString(): string {
    return `${this.newRule.selector} { ${this.decl.prop}: ${this.decl.value}${this.decl.important ? " !important": ""}; }`;
  }

  get sourcePosition(): SourcePosition | undefined {
    return this.declSourcePosition(this.originalDecls[0].decl);
  }

  declSourcePosition(decl: postcss.Declaration) {
    if (decl.source && decl.source.start) {
      return {
        filename: decl.source.input.file,
        line: decl.source.start.line,
        column: decl.source.start.column
      };
    } else {
      return undefined;
    }
  }
}
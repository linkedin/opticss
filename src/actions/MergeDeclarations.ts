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
  removedRules: postcss.Rule[];
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
    this.removedRules = [];
  }

  perform(): this {
    let classname = this.identGenerators.nextIdent("class");
    this.newRule = postcss.rule({selector: `.${classname}`});
    this.newRule.raws = { before:' ', after: ' ', semicolon: true};
    let decl = postcss.decl(this.decl);
    decl.raws = { before:' ', after: ' '};
    this.newRule.append(decl);
    this.container.append(this.newRule);
    for (let orig of this.originalDecls) {
      if (orig.decl.parent.nodes!.filter(node => node.type === "decl").length === 1) {
        this.removedRules.push(<postcss.Rule>orig.decl.parent);
        orig.decl.parent.remove();
      } else {
        orig.decl.remove();
      }
    }
    return this;
  }

  logStrings(): Array<string> {
    let logs = new Array<string>();
    this.originalDecls.forEach((orig, i) => {
      let msg = `Declaration moved into generated rule (${this.declString()}). ${this.reason} ${i + 1} of ${this.originalDecls.length}.`;
      logs.push(this.annotateLogMessage(msg, this.nodeSourcePosition(orig.decl)));
    });
    this.removedRules.forEach(rule => {
      let msg = `Removed empty rule with selector "${rule.selector}".`;
      logs.push(this.annotateLogMessage(msg, this.nodeSourcePosition(rule)));
    });
    return logs;
  }

  declString(selector: string = this.newRule.selector): string {
    return `${selector} { ${this.decl.prop}: ${this.decl.value}${this.decl.important ? " !important": ""}; }`;
  }

  get sourcePosition(): SourcePosition | undefined {
    return this.nodeSourcePosition(this.originalDecls[0].decl);
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
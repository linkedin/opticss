import * as postcss from "postcss";
import { MultiAction } from "./Action";
import { SourcePosition } from "../SourceLocation";
import { Optimizations } from "../OpticssOptions";
import { SelectorCache } from "../query";
import { ParsedSelector, CompoundSelector, isClass } from "../parseSelector";
import { OptimizationPass } from "../OptimizationPass";
import { IdentGenerators } from "../util/IdentGenerator";
import { StyleMapping, ElementAttributes, Attribute as ElementAttribute } from "../StyleMapping";

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
  styleMapping: StyleMapping;
  removedRules: postcss.Rule[];
  declInfos: DeclarationInfo[];
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
    declInfos: Array<DeclarationInfo>,
    optimization: keyof Optimizations,
    reason: string
  ) {
    super(optimization);
    this.styleMapping = pass.styleMapping;
    this.reason = reason;
    this.container = container;
    this.cache = pass.cache;
    this.identGenerators = pass.identGenerators;
    this.decl = decl;
    this.declInfos = declInfos;
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
    let sourceAttributes = new Array<ElementAttributes>();
    for (let declInfo of this.declInfos) {
      let sel: CompoundSelector = declInfo.selector.key;
      sourceAttributes.push({
        existing: classNames(sel).map(value => ({name: "class", value})),
        unless: new Array<ElementAttribute>() // TODO: cascade resolution of exclusion classes.
      });
      if (declInfo.decl.parent === undefined) {
        continue;
      }
      if (declInfo.decl.parent.nodes!.filter(node => node.type === "decl").length === 1) {
        this.removedRules.push(<postcss.Rule>declInfo.decl.parent);
        declInfo.decl.parent.remove();
      } else {
        declInfo.decl.remove();
      }
    }
    this.styleMapping.linkAttributes({name: "class", value: classname}, sourceAttributes);
    return this;
  }

  logStrings(): Array<string> {
    let logs = new Array<string>();
    this.declInfos.forEach((orig, i) => {
      let msg = `Declaration moved into generated rule (${this.declString()}). ${this.reason} ${i + 1} of ${this.declInfos.length}.`;
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
    return this.nodeSourcePosition(this.declInfos[0].decl);
  }
}

function classNames(sel: CompoundSelector): Array<string> {
  let classes = new Array<string>();
  for (let node of sel.nodes) {
    if (isClass(node)) {
      classes.push(node.value);
    }
  }
  return classes;
}
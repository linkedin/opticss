import * as postcss from 'postcss';
import * as selectorParser from 'postcss-selector-parser';

import {
  Optimizations,
} from '../OpticssOptions';
import {
  OptimizationPass,
} from '../OptimizationPass';
import {
  CompoundSelector,
  isClass,
  isUniversal,
  ParsedSelector,
} from '../parseSelector';
import {
  ParsedSelectorAndRule,
  SelectorCache,
} from '../query';
import {
  SourcePosition,
} from '../SourceLocation';
import {
  ElementAttributes,
  SimpleAttribute as ElementAttribute,
  StyleMapping,
} from '../StyleMapping';
import {
  isAtRule
} from '../optimizations/util';
import {
  IdentGenerators,
} from '../util/IdentGenerator';
import {
  MultiAction,
} from './Action';

export interface Declaration {
  prop: string;
  value: string;
  important: boolean;
}

export interface DeclarationInfo {
  selector: ParsedSelector;
  rule: postcss.Rule;
  decl: postcss.Declaration;
  container: postcss.Node;
}

/**
 * Merges duplicate declarations from multiple rule sets into a new rule set.
 */
export class MergeDeclarations extends MultiAction {
  removedSelectors: ParsedSelectorAndRule[];
  selectorContext: ParsedSelector | undefined;
  removedAtRules: postcss.AtRule[];
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
    selectorContext: ParsedSelector | undefined,
    decl: Declaration,
    declInfos: Array<DeclarationInfo>,
    optimization: keyof Optimizations,
    reason: string
  ) {
    super(optimization);
    this.styleMapping = pass.styleMapping;
    this.reason = reason;
    this.container = container;
    this.selectorContext = selectorContext;
    this.cache = pass.cache;
    this.identGenerators = pass.identGenerators;
    this.decl = decl;
    this.declInfos = declInfos;
    this.removedRules = [];
    this.removedAtRules = [];
    this.removedSelectors = new Array<ParsedSelectorAndRule>();
  }

  perform(): this {
    let classname = this.identGenerators.nextIdent("class");
    let newSelector: string;
    if (this.selectorContext) {
      let key = this.selectorContext.key;
      let nodes = key.nodes;
      key.nodes = nodes.map(n => isUniversal(n) ? selectorParser.className({value: classname}) : n);
      newSelector = this.selectorContext.toString();
      key.nodes = nodes;
    } else {
      newSelector = `.${classname}`;
    }
    this.newRule = postcss.rule({selector: newSelector});
    this.newRule.raws = { before:'\n', after: ' ', semicolon: true};
    let decl = postcss.decl(this.decl);
    decl.raws = { before:' ', after: ' '};
    this.newRule.append(decl);

    let ruleLocation = this.declInfos.find(d => d.container === this.container)!.rule;
    this.container.insertBefore(ruleLocation, this.newRule);
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
        let rule = <postcss.Rule>declInfo.decl.parent;
        let newlyRemoved: ParsedSelectorAndRule[] = this.cache.getParsedSelectors(rule).map(s => ({parsedSelector: s, rule}));
        this.removedSelectors.splice(0, 0, ...newlyRemoved);
        let ruleParent = <postcss.Container>rule.parent;
        if (ruleParent) {
          this.removedRules.push(rule);
          ruleParent.removeChild(rule);
          if (!hasMeaningfulChildren(ruleParent)) {
            if (isAtRule(ruleParent)) {
              this.removedAtRules.push(ruleParent);
              ruleParent.remove();
            } else {
              console.warn("this is a weird parent for a rule: ", ruleParent);
            }
          }
        }
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
      let msg = `Declaration moved from "${orig.selector}" into generated rule (${this.declString()}). ${this.reason} ${i + 1} of ${this.declInfos.length}.`;
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

function hasMeaningfulChildren(container: postcss.Container | undefined) {
  return container && container.nodes &&
    container.nodes.reduce(countNonCommentNodes, 0) > 0;
}

function countNonCommentNodes(count: number, n: postcss.Node) {
  return n.type === "comment" ? count : count + 1;
}
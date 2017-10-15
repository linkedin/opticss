import * as postcss from 'postcss';
import * as selectorParser from 'postcss-selector-parser';
import {
  TemplateIntegrationOptions,
  SourcePosition,
  ElementAttributes,
  SimpleAttribute as ElementAttribute,
  SimpleTagname as ElementTagname,
  StyleMapping,
  isSimpleTagname,
} from '@opticss/template-api';

import { Optimizations } from '../../OpticssOptions';
import { OptimizationPass } from '../../OptimizationPass';
import { isAtRule } from '../../util/cssIntrospection';
import { IdentGenerators } from '../../util/IdentGenerator';
import { MultiAction } from '../Action';
import {
  CompoundSelector,
  isClass,
  isUniversal,
  isAttribute,
  isIdentifier,
  ParsedSelector,
  isTag,
  isPseudo,
  isPseudoelement,
} from '../../parseSelector';
import {
  ParsedSelectorAndRule,
  SelectorCache,
} from '../../query';
import {
  DeclarationInfo
} from '../../optimizations/MergeDeclarations/StyleInfo';

const REWRITEABLE_ATTR_OPS = ["=", "~=", undefined];

export interface Declaration {
  prop: string;
  value: string;
  important: boolean;
}

/**
 * Merges duplicate declarations from multiple rule sets into a new rule set.
 */
export class MergeDeclarations extends MultiAction {
  private templateOptions: TemplateIntegrationOptions;
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
    templateOptions: TemplateIntegrationOptions,
    pass: OptimizationPass,
    selectorContext: ParsedSelector | undefined,
    decl: Declaration,
    declInfos: Array<DeclarationInfo>,
    optimization: keyof Optimizations,
    reason: string
  ) {
    super(optimization);
    this.templateOptions = templateOptions;
    this.styleMapping = pass.styleMapping;
    this.reason = reason;
    this.container = declInfos[0].selectorInfo.container;
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

    let insertionDecl = this.declInfos[0];
    let ruleLocation = insertionDecl.selectorInfo.rule;
    this.container.insertBefore(ruleLocation, this.newRule);
    let sourceAttributes = new Array<ElementAttributes>();
    for (let declInfo of this.declInfos) {
      let sel: CompoundSelector = declInfo.selectorInfo.selector.key;
      let inputs = MergeDeclarations.inputsFromSelector(this.templateOptions, sel);
      if (!inputs) {
        throw new Error("internal error");
      }
      sourceAttributes.push({
        existing: inputs,
        unless: new Array<ElementTagname | ElementAttribute>() // TODO: cascade resolution of exclusion classes.
      });
      if (declInfo.decl.parent === undefined) {
        continue; // TODO: take this out -- it shouldn't happen.
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
      let msg = `Declaration moved from "${orig.selectorInfo.selector}" into generated rule (${this.declString()}). ${this.reason} ${i + 1} of ${this.declInfos.length}.`;
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

  /**
   * Returns the concrete html traits that the selector would match
   * or undefined if html traits aren't deducible from the selector.
   */
  static inputsFromSelector(templateOptions: TemplateIntegrationOptions, sel: CompoundSelector): Array<ElementTagname | ElementAttribute> | undefined {
    let inputs = new Array<ElementTagname | ElementAttribute>();
    for (let node of sel.nodes) {
      if (isTag(node)) {
        if (templateOptions.analyzedTagnames) {
          inputs.push({ tagname: node.value });
        } else {
          return undefined;
        }
      } else if (isClass(node)) {
        if (templateOptions.analyzedAttributes.includes("class")) {
          inputs.push({ name: "class", value: node.value });
        } else {
          return undefined;
        }
      } else if (isIdentifier(node)) {
        if (templateOptions.analyzedAttributes.includes("id")) {
          inputs.push({ name: "id", value: node.value });
        } else {
          return undefined;
        }
      } else if (isAttribute(node)) {
        if (REWRITEABLE_ATTR_OPS.includes(node.operator)
          && isAttributeAnalyzed(templateOptions, node)) {
          inputs.push({ name: node.attribute, value: node.value || "" });
        } else {
          return undefined;
        }
      } else if (isPseudo(node) || isPseudoelement(node)) {
        // pass
      } else {
        return undefined;
      }
    }

    if (inputs.every(input => isSimpleTagname(input))) return undefined;
    return inputs;
  }
}

function isAttributeAnalyzed(templateOptions: TemplateIntegrationOptions, node: selectorParser.Attribute): boolean {
  if (node.ns) return false;
  return templateOptions.analyzedAttributes.includes(node.attribute);
}

function hasMeaningfulChildren(container: postcss.Container | undefined) {
  return container && container.nodes &&
    container.nodes.reduce(countNonCommentNodes, 0) > 0;
}

function countNonCommentNodes(count: number, n: postcss.Node) {
  return n.type === "comment" ? count : count + 1;
}
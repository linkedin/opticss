import * as postcss from "postcss";
import { MultiFileOptimization } from "./Optimization";
import { ParsedCssFile } from "../CssFile";
import { OptiCSSOptions, RewritableIdents, TemplateIntegrationOptions } from "../OpticssOptions";
import { TemplateAnalysis } from "../TemplateAnalysis";
import { TemplateTypes } from "../TemplateInfo";
import { SelectorCache } from "../query";
import { ParsedSelector, isIdentifier, isClass } from "../parseSelector";
import assertNever from "../util/assertNever";
import { KnownIdents, RuleIdents, RewriteRuleIdents, IdentNode } from "../actions/RewriteRuleIdents";
import { walkRules } from "./util";
import { OptimizationPass } from "../Optimizer";

export interface NormalizedRewriteOptions {
  id: boolean;
  class: boolean;
  omitIdents: {
    id: Array<string>;
    class: Array<string>;
  };
}

function mergeIntoOpts(
  normalized: NormalizedRewriteOptions,
  opts: RewritableIdents
): void {
  normalized.id = normalized.id && opts.id;
  normalized.class = normalized.class && opts.class;
  if (opts.omitIdents && opts.omitIdents.id) {
    normalized.omitIdents.id =
      normalized.omitIdents.id.concat(opts.omitIdents.id);
  }
  if (opts.omitIdents && opts.omitIdents.class) {
    normalized.omitIdents.class =
      normalized.omitIdents.class.concat(opts.omitIdents.class);
  }
}

function rewriteOptions(
  appOptions: boolean | RewritableIdents,
  templateOptions: RewritableIdents
): NormalizedRewriteOptions {
  let combined: NormalizedRewriteOptions = {
    id: true,
    class: true,
    omitIdents: { id: [], class: []}
  };
  if (appOptions === false) {
    mergeIntoOpts(combined, {id: false, class: false});
  } else if (appOptions === true) {
    mergeIntoOpts(combined, templateOptions);
  } else {
    mergeIntoOpts(combined, appOptions);
    mergeIntoOpts(combined, templateOptions);
  }
  return combined;
}

export class RewriteIdents implements MultiFileOptimization {
  private options: OptiCSSOptions;
  private templateOptions: TemplateIntegrationOptions;
  rewriteOptions: NormalizedRewriteOptions;
  constructor(options: OptiCSSOptions, templateOptions: TemplateIntegrationOptions) {
    this.options = options;
    this.templateOptions = templateOptions;
    this.rewriteOptions = rewriteOptions(options.rewriteIdents,
                                         templateOptions.rewriteIdents);
  }
  private initKnownIdents(): KnownIdents {
    let knownIdents: KnownIdents = {
      id: new Set(this.rewriteOptions.omitIdents.id),
      class: new Set(this.rewriteOptions.omitIdents.class)
    };
    return knownIdents;
  }
  optimizeAllFiles(
    pass: OptimizationPass,
    _analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    files: ParsedCssFile[]): void
  {
    let knownIdents = this.initKnownIdents();
    let allIdents = new Array<RuleIdents>();
    let currentIdents: RuleIdents | undefined = undefined;
    this.eachIdent(files, pass.cache, (rule, selector, node) => {
      if (isClass(node)) {
        knownIdents.class.add(node.value);
      } else if (isIdentifier(node)) {
        knownIdents.id.add(node.value);
      } else {
        assertNever(node);
      }
      if (currentIdents && (currentIdents.rule !== rule) || !currentIdents) {
        if (currentIdents) {
          allIdents.push(currentIdents);
        }
        currentIdents = {
          rule,
          selectors: [selector],
          idents: [node]
        };
      } else {
        let lastSelector =
          currentIdents.selectors[currentIdents.selectors.length - 1];
        if (lastSelector !== selector) {
          currentIdents.selectors.push(selector);
        }
        currentIdents.idents.push(node);
      }
    });
    if (currentIdents) {
      allIdents.push(currentIdents);
    }

    allIdents.forEach(ident => {
      pass.actions.perform(new RewriteRuleIdents(pass, ident, knownIdents));
    });
  }

  private eachIdent(files: ParsedCssFile[], cache: SelectorCache, cb: (rule: postcss.Rule, sel: ParsedSelector, node: IdentNode) => void) {
    this.eachSelector(files, cache, (rule, sel) => {
      sel.eachSelectorNode((node) => {
        if (this.rewriteOptions.id && isIdentifier(node)) {
          cb(rule, sel, node);
        } else if (this.rewriteOptions.class && isClass(node)) {
          cb(rule, sel, node);
        }
      });
    });
  }
  private eachSelector(files: ParsedCssFile[], cache: SelectorCache, cb: (rule: postcss.Rule, sel: ParsedSelector) => void) {
    files.forEach(file => {
      walkRules(file.content.root!, (rule) => {
        cache.getParsedSelectors(rule).forEach(sel => {
          cb(rule, sel);
        });
      });
    });
  }
}
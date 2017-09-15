import { MultiFileOptimization } from "./Optimization";
import { ParsedCssFile } from "../CssFile";
import { OptiCSSOptions, TemplateIntegrationOptions, NormalizedRewriteOptions, rewriteOptions } from "../OpticssOptions";
import { TemplateAnalysis } from "../TemplateAnalysis";
import { TemplateTypes } from "../TemplateInfo";
import { ParsedSelector } from "../parseSelector";
import { RuleIdents, RewriteRuleIdents } from "../actions/RewriteRuleIdents";
import { eachFileIdent } from "./util";
import { OptimizationPass } from "../OptimizationPass";
import { Initializers } from "../initializers";

export class RewriteIdents implements MultiFileOptimization {
  initializers: Array<keyof Initializers> = ["initKnownIdents"];

  private options: OptiCSSOptions;
  private templateOptions: TemplateIntegrationOptions;
  rewriteOptions: NormalizedRewriteOptions;
  constructor(options: OptiCSSOptions, templateOptions: TemplateIntegrationOptions) {
    this.options = options;
    this.templateOptions = templateOptions;
    this.rewriteOptions = rewriteOptions(options.rewriteIdents,
                                         templateOptions.rewriteIdents);
  }
  optimizeAllFiles(
    pass: OptimizationPass,
    _analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    files: ParsedCssFile[]): void
  {
    let allIdents = new Array<RuleIdents>();
    let currentIdents: RuleIdents | undefined = undefined;
    eachFileIdent(files, pass.cache, this.rewriteOptions, (node, rule, selector) => {
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
      pass.actions.perform(new RewriteRuleIdents(pass, ident));
    });
  }
}
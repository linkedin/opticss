import { MultiFileOptimization } from "./Optimization";
import { ParsedCssFile } from "../CssFile";
import { OptiCSSOptions } from "../OpticssOptions";
import { TemplateAnalysis, TemplateTypes, TemplateIntegrationOptions, NormalizedRewriteOptions, rewriteOptions } from "@opticss/template-api";
import { RuleIdents, RewriteRuleIdents } from "../Actions/actions/RewriteRuleIdents";
import { eachFileIdent } from "../util/cssIntrospection";
import { OptimizationPass } from "../OptimizationPass";
import { Initializers } from "../initializers";

export class RewriteIdents implements MultiFileOptimization {
  name = "rewriteIdents";
  initializers: Array<keyof Initializers> = ["initKnownIdents"];

  rewriteOptions: NormalizedRewriteOptions;
  constructor(options: OptiCSSOptions, templateOptions: TemplateIntegrationOptions) {
    this.rewriteOptions = rewriteOptions(options.rewriteIdents, templateOptions.rewriteIdents);
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

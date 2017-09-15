import { ParsedCssFile } from "../CssFile";
import { OptimizationPass } from "../OptimizationPass";
import { TemplateAnalysis } from "../TemplateAnalysis";
import { TemplateTypes } from "../TemplateInfo";
import { isClass, isIdentifier } from "../parseSelector";
import { eachFileIdent } from "../optimizations/util";
import { OptiCSSOptions, TemplateIntegrationOptions, rewriteOptions } from "../OpticssOptions";
import assertNever from "../util/assertNever";

export default function initKnownIdents(
  pass: OptimizationPass,
  _analyses: TemplateAnalysis<keyof TemplateTypes>[],
  files: ParsedCssFile[],
  options: OptiCSSOptions,
  templateOptions: TemplateIntegrationOptions
): void {
  let opts = rewriteOptions(options.rewriteIdents, templateOptions.rewriteIdents);
  pass.identGenerators.reserve("id", ...opts.omitIdents.id);
  pass.identGenerators.reserve("class", ...opts.omitIdents.class);
  eachFileIdent(files, pass.cache, opts, (node) => {
    if (isClass(node)) {
      pass.identGenerators.reserve("class", node.value);
    } else if (isIdentifier(node)) {
      pass.identGenerators.reserve("id", node.value);
    } else {
      assertNever(node);
    }
  });
}
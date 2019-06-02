import { TemplateAnalysis, TemplateIntegrationOptions, TemplateTypes, rewriteOptions } from "@opticss/template-api";

import { ParsedCssFile } from "../CssFile";
import { OptiCSSOptions } from "../OpticssOptions";
import { OptimizationPass } from "../OptimizationPass";

/**
 * Initializes this OptimizationPass' ident generator with blacklisted identifiers.
 * @param pass The OptimizationPass.
 * @param analyses - All analysis objects associated with this Optimization.
 * @param files - All parsed css files being optimized.
 * @param options - This Optimization's options.
 * @param templateOptions - The compatible options for this integration's Template rewriter.
 */
export function initKnownIdents(
  pass: OptimizationPass,
  // @ts-ignore
  analyses: TemplateAnalysis<keyof TemplateTypes>[],
  // @ts-ignore
  files: ParsedCssFile[],
  options: OptiCSSOptions,
  templateOptions: TemplateIntegrationOptions,
): void {
  // Fetch normalized options
  let opts = rewriteOptions(options.rewriteIdents, templateOptions.rewriteIdents);

  // Reserve all idents specifically requested by the user.
  pass.identGenerators.reserve("class", ...opts.omitIdents.class);
  pass.identGenerators.reserve("id", ...opts.omitIdents.id);

}

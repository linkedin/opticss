import { TemplateAnalysis, TemplateIntegrationOptions, TemplateTypes, rewriteOptions } from "../../../@opticss/template-api/src";
import { assertNever } from "../../../@opticss/util/src";
import * as SelectorParser from "postcss-selector-parser";

import { ParsedCssFile } from "../CssFile";
import { OptiCSSOptions } from "../OpticssOptions";
import { OptimizationPass } from "../OptimizationPass";
import { eachFileIdent } from "../util/cssIntrospection";

const { isClassName, isIdentifier } = SelectorParser;
/**
 * Initializes this OptimizationPass' ident generator with blacklisted identifiers.
 * @param pass The OptimizationPass.
 * @param analyses - All analysis objects associated with this Optimization.
 * @param files - All parsed css files being optimized.
 * @param options - This Optimization's options.
 * @param templateOptions - The compatible options for this integratin's Template rewriter.
 */
export function initKnownIdents(
  pass: OptimizationPass,
  analyses: TemplateAnalysis<keyof TemplateTypes>[],
  files: ParsedCssFile[],
  options: OptiCSSOptions,
  templateOptions: TemplateIntegrationOptions,

): void {
  // Fetch normalized options
  let opts = rewriteOptions(options.rewriteIdents, templateOptions.rewriteIdents);

  // Reserve all idents specifically requested by the user.
  pass.identGenerators.reserve("class", ...opts.omitIdents.class);
  pass.identGenerators.reserve("id", ...opts.omitIdents.id);

  // Reserve every existing identifier used in any of the files
  eachFileIdent(files, pass.cache, opts, (node) => {
    if (isClassName(node)) {
      pass.identGenerators.reserve("class", node.value);
    } else if (isIdentifier(node)) {
      pass.identGenerators.reserve("id", node.value);
    } else {
      assertNever(node);
    }
  });

  // Reserve all idents discovered in the Templates.
  for (let analysis of analyses) {
    let allConstants = analysis.constants(new Set(["class", "id"]));
    for (let constantType of Object.keys(allConstants)) {
      for (let constant of allConstants[constantType]) {
        pass.identGenerators.reserve(<"class" | "id">constantType, constant);
      }
    }
  }
}

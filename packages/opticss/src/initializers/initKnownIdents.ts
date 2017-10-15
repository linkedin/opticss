import { ParsedCssFile } from "../CssFile";
import { OptimizationPass } from "../OptimizationPass";
import { TemplateIntegrationOptions, TemplateTypes, TemplateAnalysis, rewriteOptions } from "@opticss/template-api";
import { isClass, isIdentifier } from "../parseSelector";
import { eachFileIdent } from "../util/cssIntrospection";
import { OptiCSSOptions } from "../OpticssOptions";
import { assertNever } from "@opticss/util";

/**
 * Initializes this OptimizationPass' ident generator with blacklisted identifiers.
 * @param {OptimizationPass} pass The OptimizationPass.
 * @param {TemplateAnalysis<keyof TemplateTypes>[]} analyses - All analysis objects associated with this Optimization.
 * @param {ParsedCssFile[]} files - All parsed css files being optimized.
 * @param {OptiCSSOptions} options - This Optimization's options.
 * @param {TemplateIntegrationOptions} templateOptions - The compatible options for this integratin's Template rewriter.
 */
export default function initKnownIdents(
  pass: OptimizationPass,
  analyses: TemplateAnalysis<keyof TemplateTypes>[],
  files: ParsedCssFile[],
  options: OptiCSSOptions,
  templateOptions: TemplateIntegrationOptions
): void {
  // Fetch normalized options
  let opts = rewriteOptions(options.rewriteIdents, templateOptions.rewriteIdents);

  // Reserve all idents specifically requested by the user.
  pass.identGenerators.reserve("class", ...opts.omitIdents.class);
  pass.identGenerators.reserve("id", ...opts.omitIdents.id);

  // Reserve every existing identifier used in any of the files
  eachFileIdent(files, pass.cache, opts, (node) => {
    if (isClass(node)) {
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

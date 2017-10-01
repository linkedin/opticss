import { ParsedCssFile } from "../CssFile";
import { OptimizationPass } from "../OptimizationPass";
import { TemplateTypes, TemplateAnalysis } from "@opticss/template-api";
import { isClass, isIdentifier } from "../parseSelector";
import { eachFileIdent } from "../optimizations/util";
import { OptiCSSOptions, TemplateIntegrationOptions, rewriteOptions } from "../OpticssOptions";
import { assertNever } from "@opticss/util";

export default function initKnownIdents(
  pass: OptimizationPass,
  analyses: TemplateAnalysis<keyof TemplateTypes>[],
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
  for (let analysis of analyses) {
    let allConstants = analysis.constants(new Set(["class", "id"]));
    for (let constantType of Object.keys(allConstants)) {
      for (let constant of allConstants[constantType]) {
        pass.identGenerators.reserve(<"class" | "id">constantType, constant);
      }
    }
  }
}
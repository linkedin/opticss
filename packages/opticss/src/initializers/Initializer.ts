import { ParsedCssFile } from "../CssFile";
import { OptimizationPass } from "../OptimizationPass";
import { TemplateTypes, TemplateAnalysis, TemplateIntegrationOptions } from "@opticss/template-api";
import { OptiCSSOptions } from "../OpticssOptions";

export type Initializer = (
  pass: OptimizationPass,
  analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
  files: Array<ParsedCssFile>,
  options: OptiCSSOptions,
  templateOptions: TemplateIntegrationOptions
) => void;

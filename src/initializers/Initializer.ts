import { ParsedCssFile } from "../CssFile";
import { OptimizationPass } from "../OptimizationPass";
import { TemplateAnalysis } from "../TemplateAnalysis";
import { TemplateTypes } from "../TemplateInfo";
import { OptiCSSOptions, TemplateIntegrationOptions } from "../OpticssOptions";

export type Initializer = (
  pass: OptimizationPass,
  analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
  files: Array<ParsedCssFile>,
  options: OptiCSSOptions,
  templateOptions: TemplateIntegrationOptions
) => void;

import { TemplateAnalysis, TemplateIntegrationOptions, TemplateTypes } from "../../../@opticss/template-api/src";

import { ParsedCssFile } from "../CssFile";
import { OptiCSSOptions } from "../OpticssOptions";
import { OptimizationPass } from "../OptimizationPass";

import { initKnownIdents } from "./initKnownIdents";

// The expected interface of an initializer function.
export type Initializer = (
  pass: OptimizationPass,
  analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
  files: Array<ParsedCssFile>,
  options: OptiCSSOptions,
  templateOptions: TemplateIntegrationOptions,
) => void;

// Initializer Manifest Interface
export interface Initializers {
  initKnownIdents: Initializer;
}

// Initializer Manifest
export const initializers: Initializers = {
  initKnownIdents,
};

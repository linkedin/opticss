import { TemplateTypes, TemplateAnalysis, TemplateIntegrationOptions } from "@opticss/template-api";

import { ParsedCssFile } from "../CssFile";
import { OptimizationPass } from "../OptimizationPass";
import { OptiCSSOptions } from "../OpticssOptions";

import initKnownIdents from "./initKnownIdents";

// The expected interface of an initializer function.
export type Initializer = (
  pass: OptimizationPass,
  analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
  files: Array<ParsedCssFile>,
  options: OptiCSSOptions,
  templateOptions: TemplateIntegrationOptions
) => void;

// Initializer Manifest Interface
export interface Initializers {
  initKnownIdents: Initializer;
}

// Initializer Manifest
const initializers: Initializers = {
  initKnownIdents,
};

export default initializers;
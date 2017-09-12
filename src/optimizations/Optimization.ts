import { ParsedCssFile } from "../CssFile";
import { TemplateAnalysis } from "../TemplateAnalysis";
import { OptiCSSOptions, TemplateIntegrationOptions } from "../OpticssOptions";
import { TemplateTypes } from "../TemplateInfo";
import { OptimizationPass } from "../Optimizer";

// Optimizations TODO:
//   * normalize values
//   * convert initial to initial value
//   * combine selectors that are always applied to the same elements.
//   * combine long-hands into shorthands (sometimes add a de-opt for shared prop)

export interface OptimizationConstructor {
  new (options: OptiCSSOptions,
       templateOptions: TemplateIntegrationOptions): Optimization;
}

export interface SingleFileOptimization {
  optimizeSingleFile(
    pass: OptimizationPass,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    file: ParsedCssFile): void;
}

export interface MultiFileOptimization {
  optimizeAllFiles(
    pass: OptimizationPass,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    files: Array<ParsedCssFile>): void;
}

export type Optimization = SingleFileOptimization
                         | MultiFileOptimization
                         | SingleFileOptimization & MultiFileOptimization;
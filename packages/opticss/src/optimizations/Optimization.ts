import { TemplateAnalysis, TemplateIntegrationOptions, TemplateTypes } from "@opticss/template-api";

import { ParsedCssFile } from "../CssFile";
import { Initializers } from "../initializers";
import { OptiCSSOptions } from "../OpticssOptions";
import { OptimizationPass } from "../OptimizationPass";

// Optimizations TODO:
//   ✓ Remove unused styles.
//   ✓ Rewrite idents (consider moving to end of optimization pipeline.)
//   * Reduce to order-of-a-class specificity (ID => class)
//   * Remove static selector scope (map class in scope to new class)
//   * Remove dynamic selector scope (map class in scope to new class when ancestor changes)
//   * Normalize values
//   * Convert initial to initial value
//   ✓ Merge declarations
//   * Combine selectors that are always applied to the same elements and merge their declarations into a single ruleset.
//   * Combine long-hands into shorthands (sometimes add a de-opt for merged prop) Open question: is this actually worse for browser perf?
//   * Combine rulesets with identical declarations to a single ruleset with multiple selectors (if doesn't introduce cascade issues)
//   * Remove redundant declarations where it's clear the properties aren't being progressively enhanced.

export interface OptimizationConstructor {
  new (options: OptiCSSOptions,
       templateOptions: TemplateIntegrationOptions): Optimization;
}

export interface SingleFileOptimization {
  name: string;
  readonly initializers: Array<keyof Initializers>;
  optimizeSingleFile(
    pass: OptimizationPass,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    file: ParsedCssFile): void;
}

export interface MultiFileOptimization {
  name: string;
  readonly initializers: Array<keyof Initializers>;
  optimizeAllFiles(
    pass: OptimizationPass,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    files: Array<ParsedCssFile>): void;
}

export function isMultiFileOptimization(optimization: Optimization): optimization is MultiFileOptimization {
  return !!(<MultiFileOptimization>optimization).optimizeAllFiles;
}

export function isSingleFileOptimization(optimization: Optimization): optimization is SingleFileOptimization {
  return !!(<SingleFileOptimization>optimization).optimizeSingleFile;
}

export type Optimization = SingleFileOptimization
                         | MultiFileOptimization
                         | SingleFileOptimization & MultiFileOptimization;

import { ParsedCssFile } from "../CssFile";
import { TemplateAnalysis } from "../TemplateAnalysis";
import { OptiCSSOptions, TemplateIntegrationOptions } from "../OpticssOptions";
import { TemplateTypes } from "../TemplateInfo";
import { OptimizationPass } from "../OptimizationPass";
import { Initializers } from "../initializers";

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
  readonly initializers: Array<keyof Initializers>;
  optimizeSingleFile(
    pass: OptimizationPass,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    file: ParsedCssFile): void;
}

export interface MultiFileOptimization {
  readonly initializers: Array<keyof Initializers>;
  optimizeAllFiles(
    pass: OptimizationPass,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    files: Array<ParsedCssFile>): void;
}

export type Optimization = SingleFileOptimization
                         | MultiFileOptimization
                         | SingleFileOptimization & MultiFileOptimization;
import { ParsedCssFile } from "../CssFile";
import { StyleMapping } from "../StyleMapping";
import { TemplateAnalysis } from "../TemplateAnalysis";
import { OptiCSSOptions } from "../OpticssOptions";
import { TemplateTypes } from "../TemplateInfo";
import { SelectorCache } from "../query";

export interface OptimizationConstructor {
  new (options: OptiCSSOptions): Optimization;
}

export interface SingleFileOptimization {
  optimizeSingleFile(
    styleMapping: StyleMapping,
    file: ParsedCssFile,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    cache: SelectorCache): void;
}

export interface MultiFileOptimization {
  optimizeAllFiles(
    styleMapping: StyleMapping,
    files: Array<ParsedCssFile>,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    cache: SelectorCache): void;
}

export type Optimization = SingleFileOptimization
                         | MultiFileOptimization
                         | SingleFileOptimization & MultiFileOptimization;
import { ParsedCssFile } from "../CssFile";
import { StyleMapping } from "../StyleMapping";
import { TemplateAnalysis } from "../TemplateAnalysis";
import { OptiCSSOptions } from "../OpticssOptions";
import { TemplateTypes } from "../TemplateInfo";
import { SelectorCache } from "../query";
import { Actions } from "../Actions";

export interface OptimizationConstructor {
  new (options: OptiCSSOptions): Optimization;
}

export interface SingleFileOptimization {
  optimizeSingleFile(
    styleMapping: StyleMapping,
    file: ParsedCssFile,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    cache: SelectorCache,
    actions: Actions): void;
}

export interface MultiFileOptimization {
  optimizeAllFiles(
    styleMapping: StyleMapping,
    files: Array<ParsedCssFile>,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    cache: SelectorCache,
    actions: Actions): void;
}

export type Optimization = SingleFileOptimization
                         | MultiFileOptimization
                         | SingleFileOptimization & MultiFileOptimization;
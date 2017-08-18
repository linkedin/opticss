import { CssFile } from "../CssFile";
import { StyleMapping } from "../StyleMapping";
import { OptiCSSOptions } from "../OpticssOptions";

export interface OptimizationConstructor {
  new (options: OptiCSSOptions): Optimization;
}

export interface SingleFileOptimization {
  optimizeSingleFile(styleMapping: StyleMapping, file: CssFile): void;
}

export interface MultiFileOptimization {
  optimizeAllFiles(styleMapping: StyleMapping, files: Array<CssFile>): void;
}

export type Optimization = SingleFileOptimization
                         | MultiFileOptimization
                         | SingleFileOptimization & MultiFileOptimization;
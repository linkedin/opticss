import {
  OptimizationConstructor,
} from "./Optimization";

import { RemoveUnusedStyles } from "./RemoveUnusedStyles";
import { RewriteIdents } from "./RewriteIdents";
import { MergeDeclarations } from "./MergeDeclarations";

export {
  Optimization,
  OptimizationConstructor,
  MultiFileOptimization,
  SingleFileOptimization,
  isMultiFileOptimization,
  isSingleFileOptimization
} from "./Optimization";

export interface Optimizations {
  removeUnusedStyles: typeof RemoveUnusedStyles;
  rewriteIdents: typeof RewriteIdents;
  mergeDeclarations: typeof MergeDeclarations;
  [optimization: string]: OptimizationConstructor;
}

// TODO: enforce execution order of optimizations listed here.
export const optimizations: Optimizations = {
  removeUnusedStyles: RemoveUnusedStyles,
  mergeDeclarations: MergeDeclarations,
  rewriteIdents: RewriteIdents,
};
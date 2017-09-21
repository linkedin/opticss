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
  SingleFileOptimization
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
  rewriteIdents: RewriteIdents,
  mergeDeclarations: MergeDeclarations
};
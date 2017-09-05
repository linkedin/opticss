import {
  OptimizationConstructor,
} from "./Optimization";

import { RemoveUnusedStyles } from "./RemoveUnusedStyles";
import { RewriteIdents } from "./RewriteIdents";

export {
  Optimization,
  OptimizationConstructor,
  MultiFileOptimization,
  SingleFileOptimization
} from "./Optimization";

export interface Optimizations {
  removeUnusedStyles: typeof RemoveUnusedStyles;
  rewriteIdents: typeof RewriteIdents;
  [optimization: string]: OptimizationConstructor;
}

export const optimizations: Optimizations = {
  removeUnusedStyles: RemoveUnusedStyles,
  rewriteIdents: RewriteIdents
};
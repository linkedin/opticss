import {
  OptimizationConstructor,
} from "./Optimization";

import { RemoveUnusedStyles } from "./RemoveUnusedStyles";
import { RewriteIdents } from "./RewriteIdents";
import { ShareDeclarations } from "./ShareDeclarations";

export {
  Optimization,
  OptimizationConstructor,
  MultiFileOptimization,
  SingleFileOptimization
} from "./Optimization";

export interface Optimizations {
  removeUnusedStyles: typeof RemoveUnusedStyles;
  rewriteIdents: typeof RewriteIdents;
  shareDeclarations: typeof ShareDeclarations;
  [optimization: string]: OptimizationConstructor;
}

export const optimizations: Optimizations = {
  removeUnusedStyles: RemoveUnusedStyles,
  rewriteIdents: RewriteIdents,
  shareDeclarations: ShareDeclarations
};
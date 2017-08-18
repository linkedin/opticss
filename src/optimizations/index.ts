import {
  RemoveUnusedStyles
} from "./RemoveUnusedStyles";

import {
  OptimizationConstructor,
} from "./Optimization";

export {
  Optimization,
  OptimizationConstructor,
  MultiFileOptimization,
  SingleFileOptimization
} from "./Optimization";

export interface Optimizations {
  removeUnusedStyles: typeof RemoveUnusedStyles;
  [optimization: string]: OptimizationConstructor;
}

export const optimizations: Optimizations = {
  removeUnusedStyles: RemoveUnusedStyles,
};
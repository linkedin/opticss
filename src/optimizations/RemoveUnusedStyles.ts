import { SingleFileOptimization } from "./Optimization";
import { StyleMapping } from "../StyleMapping";
import { CssFile } from "../CssFile";
import { OptiCSSOptions } from "../OpticssOptions";

export class RemoveUnusedStyles implements SingleFileOptimization {
  private options: OptiCSSOptions;
  constructor(options: OptiCSSOptions) {
    this.options = options;
  }
  optimizeSingleFile(_styleMapping: StyleMapping, _file: CssFile): void {
    // Do nothing
  }
}
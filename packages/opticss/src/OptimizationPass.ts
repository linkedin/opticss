import { StyleMapping, TemplateIntegrationOptions } from "@opticss/template-api";
import { SelectorCache } from "./query";
import { Actions } from "./Actions";
import { IdentGenerators } from "./util/IdentGenerator";
import { OptiCSSOptions } from "./OpticssOptions";

export class OptimizationPass {
  styleMapping: StyleMapping;
  cache: SelectorCache;
  actions: Actions;
  identGenerators: IdentGenerators<"id" | "class">;
  constructor(options: OptiCSSOptions, templateOptions: TemplateIntegrationOptions) {
    this.styleMapping = new StyleMapping(templateOptions);
    this.cache = new SelectorCache();
    this.actions = new Actions();
    this.identGenerators = new IdentGenerators(options.css!.caseInsensitiveSelectors!, "id", "class");
  }
}
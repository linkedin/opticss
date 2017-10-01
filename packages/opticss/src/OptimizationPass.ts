import { StyleMapping } from "@opticss/template-api";
import { SelectorCache } from "./query";
import { Actions } from "./Actions";
import { IdentGenerators } from "./util/IdentGenerator";

export class OptimizationPass {
  styleMapping: StyleMapping;
  cache: SelectorCache;
  actions: Actions;
  identGenerators: IdentGenerators<"id" | "class">;
  constructor() {
    this.styleMapping = new StyleMapping();
    this.cache = new SelectorCache();
    this.actions = new Actions();
    this.identGenerators = new IdentGenerators("id", "class");
  }
}
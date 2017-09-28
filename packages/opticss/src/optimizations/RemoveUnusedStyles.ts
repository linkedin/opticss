import { SingleFileOptimization } from "./Optimization";
import { ParsedCssFile } from "../CssFile";
import { OptiCSSOptions } from "../OpticssOptions";
import { TemplateAnalysis } from "../TemplateAnalysis";
import { TemplateTypes } from "../TemplateInfo";
import { Element } from "../Selectable";
import { matches } from "../Match";
import { RemoveRule } from "../actions/RemoveRule";
import { ChangeSelector } from "../actions/ChangeSelector";
import { walkRules } from "./util";
import { OptimizationPass } from "../OptimizationPass";
import { Initializers } from "../initializers";

export class RemoveUnusedStyles implements SingleFileOptimization {
  name = "removeUnusedStyles";
  initializers: Array<keyof Initializers> = [];
  private options: OptiCSSOptions;

  constructor(options: OptiCSSOptions) {
    this.options = options;
  }
  optimizeSingleFile(
    pass: OptimizationPass,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    file: ParsedCssFile): void
  {
    let elements = analyses.reduce((elements, analysis) => {
      elements.push(...analysis.elements);
      return elements;
    }, new Array<Element>());
    walkRules(file.content.root!, (node) => {
      let parsedSelectors = pass.cache.getParsedSelectors(node);
      let reason: string | undefined = undefined;
      let found = parsedSelectors.filter((value) => {
        return value.eachCompoundSelector((selector) => {
          let found = elements.find((element) => matches(element.matchSelectorComponent(selector)));
          if (!found || selector === value.key) {
            if (!found) {
              reason = `no element found that matches ${selector.toString(true)}`;
            }
            return !!found;
          } else {
            return;
          }
        });
      });
      if (found.length === 0) {
        pass.actions.perform(new RemoveRule(node, "removeUnusedStyles", reason!, pass.cache));
      } else {
        if (found.length < parsedSelectors.length) {
          pass.actions.perform(new ChangeSelector(node, found.join(", "), "removeUnusedStyles", reason!, pass.cache));
        }
      }
    });
  }
}
import { SingleFileOptimization } from "./Optimization";
import { StyleMapping } from "../StyleMapping";
import { ParsedCssFile } from "../CssFile";
import { OptiCSSOptions } from "../OpticssOptions";
import { TemplateAnalysis } from "../TemplateAnalysis";
import { TemplateTypes } from "../TemplateInfo";
import { Element } from "../Styleable";
import { SelectorCache } from "../query";
import { matches } from "../Match";
import { Actions, RemoveRule, ChangeSelector } from "../Actions";

export class RemoveUnusedStyles implements SingleFileOptimization {
  private options: OptiCSSOptions;
  constructor(options: OptiCSSOptions) {
    this.options = options;
  }
  optimizeSingleFile(_styleMapping: StyleMapping, file: ParsedCssFile,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>, cache: SelectorCache, actions: Actions): void
  {
    let elements = analyses.reduce((elements, analysis) => {
      elements.push(...analysis.elements);
      return elements;
    }, new Array<Element>());
    file.content.root!.walkRules((node) => {
      let parsedSelectors = cache.getParsedSelectors(node);
      let found = parsedSelectors.filter((value) => {
        return value.eachCompoundSelector((selector) => {
          let found = elements.find((element) => matches(element.matchSelectorComponent(selector)));
          if (!found || selector === value.key) {
            return !!found;
          } else {
            return;
          }
        });
      });
      if (found.length === 0) {
        actions.perform(new RemoveRule(node, cache));
      } else {
        if (found.length < parsedSelectors.length) {
          actions.perform(new ChangeSelector(node, found.join(", "), cache));
        }
      }
    });
  }
}
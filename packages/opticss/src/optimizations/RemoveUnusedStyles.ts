import { SingleFileOptimization } from "./Optimization";
import { ParsedCssFile } from "../CssFile";
import { OptiCSSOptions } from "../OpticssOptions";
import { Element, TemplateTypes, TemplateAnalysis } from "@opticss/template-api";
import { matches, ElementMatcher } from "../Match";
import { RemoveRule } from "../Actions";
import { ChangeSelector } from "../Actions";
import { walkRules } from "../util/cssIntrospection";
import { OptimizationPass } from "../OptimizationPass";
import { Initializers } from "../initializers";

/**
 * Removed all rules in a single stylesheet that will never match any Selectables
 * discovered during analysis.
 */
export class RemoveUnusedStyles implements SingleFileOptimization {
  name = "removeUnusedStyles";
  initializers: Array<keyof Initializers> = [];
  private options: OptiCSSOptions;

  /**
   * Create a new instance of this optimizer
   * @param {OptiCSSOptions} options - The project optimizer's options.
   */
  constructor(options: OptiCSSOptions) {
    this.options = options;
  }

  /**
   * Provided an OptimizationPass, all TemplateAnalyses, and a ParsedCssFile,
   * remove all unused styles.
   * @param {OptimizationPass} pass
   * @param {Array<TemplateAnalysis<keyof TemplateTypes>>} analyses - All TemplateAnalyses found during analysis
   * @param {ParsedCssFile} file - The parsed CSS file to optimize.
   */
  optimizeSingleFile(
    pass: OptimizationPass,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    file: ParsedCssFile
  ): void {

    // Fetch the list of all Elements discovered during analysis.
    let elements = analyses.reduce((elements, analysis) => {
      elements.push(...analysis.elements);
      return elements;
    }, new Array<Element>());

    // For each rule in the ParsedCSSFile:
    walkRules(file.content.root!, (node) => {
      let parsedSelectors = pass.cache.getParsedSelectors(node);
      let reason: string | undefined = undefined;

      // Check if it matches any element discovered during analysis.
      let found = parsedSelectors.filter((value) => {
        return value.eachCompoundSelector((selector) => {
          let found = elements.find((element) => matches(ElementMatcher.instance.matchSelectorComponent(element, selector)));
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

      // If no elements discovered during Analysis match this style, remove the rule.
      if (found.length === 0) {
        pass.actions.perform(new RemoveRule(node, "removeUnusedStyles", reason!, pass.cache));
      }

      // QUESTION: @Chris, what does this do?
      else {
        if (found.length < parsedSelectors.length) {
          pass.actions.perform(new ChangeSelector(node, found.join(", "), "removeUnusedStyles", reason!, pass.cache));
        }
      }
    });
  }
}

import * as parse5 from "parse5";
import { assert } from "chai";

import { TemplateAnalysis } from "../../src/TemplateAnalysis";
import { OptiCSSOptions, TemplateIntegrationOptions } from "../../src/OpticssOptions";
import { OptimizationResult, Optimizer } from "../../src/Optimizer";

import { Cascade, walkElements, allElements } from "./Cascade";
import { SimpleTemplateRunner } from "./SimpleTemplateRunner";
import { SimpleAnalyzer } from "./SimpleAnalyzer";
import { TestTemplate } from "./TestTemplate";
import { SimpleTemplateRewriter } from "./SimpleTemplateRewriter";

export function assertSameCascade(
  originalCss: string,
  optimizedCss: string,
  templateHtml: string,
  originalHtml: string,
  optimizedHtml: string
): Promise<void> {
  // console.log("template HTML:", templateHtml);
  // console.log("original HTML:", originalHtml);
  // console.log("optimized HTML:", optimizedHtml);
  let templateDoc = parseHtml(templateHtml);
  let originalDoc = parseHtml(originalHtml);
  let optimizedDoc = parseHtml(optimizedHtml);
  let originalCascade = new Cascade(originalCss, originalDoc);
  let originalCascadePromise = originalCascade.perform();
  let optimizedCascade = new Cascade(optimizedCss, optimizedDoc);
  let optimizedCascadePromise = optimizedCascade.perform();
  let cascades = [originalCascadePromise, optimizedCascadePromise];
  return Promise.all(cascades).then(([origCascade, optiCascade]) => {
    let templateElements = allElements(templateDoc);
    let originalElements = allElements(originalDoc);
    let optimizedElements = allElements(optimizedDoc);
    assert.equal(originalElements.length,
                 templateElements.length,
                 "original document doesn't match template");
    assert.equal(optimizedElements.length,
                 templateElements.length,
                 "rewritten document doesn't match template");
    for (let i = 0; i < originalElements.length; i++) {
      let templateElement = templateElements[i];
      let originalElement = originalElements[i];
      let optimizedElement = optimizedElements[i];
      let origStyle = origCascade.get(originalElement);
      let optiStyle = optiCascade.get(optimizedElement);
      if (origStyle || optiStyle) {
        // TODO: pseudoelement and pseudostate support
        let origComputed = origStyle && origStyle.compute();
        let optiComputed = optiStyle && optiStyle.compute();
        try {
          assert.deepEqual(optiComputed, origComputed);
        } catch (e) {
          let templateStr = parse5.serialize(templateElement, { treeAdapter: parse5.treeAdapters.htmlparser2 });
          console.warn("template element:",  templateElement.tagName, templateStr);
          let origStr = parse5.serialize(originalElement, { treeAdapter: parse5.treeAdapters.htmlparser2 });
          console.warn("original element:",  originalElement.tagName, origStr);
          let optiStr = parse5.serialize(optimizedElement, { treeAdapter: parse5.treeAdapters.htmlparser2 });
          console.warn("optimized element:",  optimizedElement.tagName, optiStr);
          if (origComputed) {
            console.warn("original cascade:", origStyle && origStyle.debug());
            console.warn("original computed styles:", origComputed);
          }
          if (optiComputed) {
            console.warn("optimized cascade:", optiStyle && optiStyle.debug());
            console.warn("optimized computed styles:", optiComputed);
          }
          throw e;
        }
      }
    }
  });
}

export interface TemplateRewrites {
  template: string;
  rewrites: string[];
}

export interface CascadeTestResult {
  optimization: OptimizationResult;
  templateResults: Array<TemplateRewrites>;
}

export function testOptimizationCascade(
  options: Partial<OptiCSSOptions>,
  templateOptions: TemplateIntegrationOptions,
  ...stylesAndTemplates: Array<string | TestTemplate>
): Promise<CascadeTestResult> {
  let optimizer = new Optimizer(options, templateOptions);
  let nCss = 1;
  let originalCss = "";
  let analysisPromises = new Array<Promise<TemplateAnalysis<"TestTemplate">>>();
  let templates = new Array<TestTemplate>();
  stylesAndTemplates.forEach(styleOrTemplate => {
    if (typeof styleOrTemplate === "string") {
      originalCss += (originalCss.length > 0 ? "\n" : "") + styleOrTemplate;
      optimizer.addSource({ content: styleOrTemplate, filename: `test${nCss++}.css` });
    } else {
      let analyzer = new SimpleAnalyzer(styleOrTemplate);
      analysisPromises.push(analyzer.analyze());
      templates.push(styleOrTemplate);
    }
  });
  return Promise.all(analysisPromises).then(analyses => {
    analyses.forEach(a => {
      optimizer.addAnalysis(a);
    });
  }).then(() => {
    return optimizer.optimize("optimized.css").then(optimization => {
      let rewriter = new SimpleTemplateRewriter(optimization.styleMapping);
      let allTemplateRuns = new Array<Promise<TemplateRewrites>>();
      templates.forEach(template => {
        let runner = new SimpleTemplateRunner(template);
        let promise = runner.runAll().then(result => {
          let cascadeAssertions = new Array<Promise<string>>();
          result.forEach((html) => {
            let rewrittenHtml = rewriter.rewrite(template.contents, html);
            cascadeAssertions.push(
              assertSameCascade(originalCss,
                                optimizationToCss(optimization),
                                template.contents,
                                html,
                                rewrittenHtml).then(() => {
                                  return rewrittenHtml;
                                }));
          });
          return Promise.all(cascadeAssertions).then(rewrites => {
            return {
              template: template.contents,
              rewrites
            };
          });
        });
        allTemplateRuns.push(promise);
      });
      return Promise.all(allTemplateRuns).then((templateResults) => {
        return {
          optimization,
          templateResults
        };
      });
    });
  });

}

function optimizationToCss(opt: OptimizationResult): string {
  let content = opt.output.content;
  if (typeof content === "string") {
    return content;
  } else {
    return content.css;
  }
}

type Document = parse5.AST.HtmlParser2.Document;

function parseHtml(html: string): Document {
  return parse5.parse(html, {
    treeAdapter: parse5.treeAdapters.htmlparser2
  }) as Document;
}
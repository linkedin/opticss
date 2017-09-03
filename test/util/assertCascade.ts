import * as parse5 from "parse5";
import { assert } from "chai";

import { TemplateAnalysis } from "../../src/TemplateAnalysis";
import { OptiCSSOptions } from "../../src/OpticssOptions";
import { OptimizationResult, Optimizer } from "../../src/Optimizer";

import { Cascade, walkElements } from "./Cascade";
import { SimpleTemplateRunner } from "./SimpleTemplateRunner";
import { SimpleAnalyzer } from "./SimpleAnalyzer";
import { TestTemplate } from "./TestTemplate";

export function assertSameCascade(
  originalCss: string,
  optimizedCss: string,
  html: string
): Promise<void> {
  let doc = parseHtml(html);
  let originalCascade = new Cascade(originalCss, doc);
  let originalCascadePromise = originalCascade.perform();
  let optimizedCascade = new Cascade(optimizedCss, doc);
  let optimizedCascadePromise = optimizedCascade.perform();
  let cascades = [originalCascadePromise, optimizedCascadePromise];
  return Promise.all(cascades).then(([origCascade, optiCascade]) => {
    walkElements(doc, (element) => {
      let elStr = parse5.serialize(element, { treeAdapter: parse5.treeAdapters.htmlparser2 });
      let origStyle = origCascade.get(element);
      let optiStyle = optiCascade.get(element);
      if (origStyle || optiStyle) {
        // TODO: pseudoelement and pseudostate support
        // console.log("Element:",  element.tagName, elStr);
        let origComputed = origStyle && origStyle.compute();
        let optiComputed = optiStyle && optiStyle.compute();
        // if (origComputed) {
        //   console.log("cascade:", origStyle && origStyle.debug());
        //   console.log("orig computed:", origComputed);
        // }
        // if (optiComputed) {
        //   console.log("cascade:", optiStyle && optiStyle.debug());
        //   console.log("opti computed:", optiComputed);
        // }
        assert.deepEqual(optiStyle, origStyle);
      }
    });
  });
}

export function testOptimizationCascade(
  options: Partial<OptiCSSOptions>,
  ...stylesAndTemplates: Array<string | TestTemplate>
): Promise<OptimizationResult> {
  let optimizer = new Optimizer(options);
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
      let allTemplateRuns = new Array<Promise<void[]>>();
      templates.forEach(template => {
        let runner = new SimpleTemplateRunner(template);
        let promise = runner.runAll().then(result => {
          let cascadeAssertions = new Array<Promise<void>>();
          result.forEach((html) => {
            cascadeAssertions.push(
              assertSameCascade(originalCss,
                                optimizationToCss(optimization),
                                html));
          });
          return Promise.all(cascadeAssertions);
        });
        allTemplateRuns.push(promise);
      });
      return Promise.all(allTemplateRuns).then(() => {
        return optimization;
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
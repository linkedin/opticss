import { suite, test, skip, only } from "mocha-typescript";
import { assert } from "chai";

import { Optimizer, OptimizationResult } from "../src/Optimizer";
import { TestTemplate } from "./util/TestTemplate";
import { SimpleAnalyzer } from "./util/SimpleAnalyzer";
import clean from "./util/clean";
import { RemoveRule, ChangeSelector } from "../src/Actions";
import * as path from "path";
import { SimpleTemplateRunner } from "./util/SimpleTemplateRunner";
import { TemplateAnalysis } from "../src/TemplateAnalysis";

function testRewriteIdents(stylesAndTemplates: Array<string | TestTemplate>): Promise<OptimizationResult> {
  let optimizer = new Optimizer({
    only: ["rewriteIdents"]
  });
  let nCss = 1;
  let analysisPromises = new Array<Promise<TemplateAnalysis<"TestTemplate">>>();
  let templates = new Array<TestTemplate>();
  stylesAndTemplates.forEach(styleOrTemplate => {
    if (typeof styleOrTemplate === "string") {
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
    return optimizer.optimize("optimized.css").then(result => {
      let allTemplateRuns = new Array<Promise<string[]>>();
      templates.forEach(template => {
        let runner = new SimpleTemplateRunner(template);
        let promise = runner.runAll().then(result => {
          result.forEach((t, i) => {
            console.log(`Resolved Template ${i}:`, t);
          });
          return result;
        });
        allTemplateRuns.push(promise);
      });
      return Promise.all(allTemplateRuns).then(() => {
        return result;
      });
    });
  });
}

@suite("Rewrite idents")
export class RemoveUnusedStylesTest {
  @only
  @test "rewrites idents"() {
    let css1 = `.thing1 { color: red; }`;
    let css2 = `.thing1, .thing2 { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="(thing3 | thing1)" id="(a | b)"></div>
      <div class="(--- | thing2 | thing4)"></div>
    `);
    return testRewriteIdents([css1, css2, template]);
  }
}
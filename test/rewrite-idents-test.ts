import { suite, test, skip, only } from "mocha-typescript";
import { assert } from "chai";

import { OptimizationResult } from "../src/Optimizer";
import { TestTemplate } from "./util/TestTemplate";
import clean from "./util/clean";
import { testOptimizationCascade } from "./util/assertCascade";

function testRewriteIdents(...stylesAndTemplates: Array<string | TestTemplate>): Promise<OptimizationResult> {
  return testOptimizationCascade({
    only: ["rewriteIdents"]
  }, ...stylesAndTemplates);
}

@suite("Rewrite idents")
export class RemoveUnusedStylesTest {
  @only
  @test "rewrites idents"() {
    let css1 = `
      #c { border-width: 2px; }
      #a { color: blue; }
      .thing1 { color: red; }
      #b { width: 50%; }
      .thing2 { border: 1px solid blue; }
      .thing3 { background: red; }
      div { background-color: white; }
      #c.thing4 { border-color: black; }
    `;
    let template = new TestTemplate("test", clean`
      <div class="(thing3 | thing1)" id="(a | b)"></div>
      <div class="(--- | thing2 | thing4)" id="c"></div>
    `);
    return testRewriteIdents(css1, template).then(result => {
      assert.isDefined(result.styleMapping);
    });
  }
}

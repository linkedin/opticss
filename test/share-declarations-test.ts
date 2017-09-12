import { suite, test, skip, only } from "mocha-typescript";
import { assert } from "chai";
import * as path from "path";

import { OptimizationResult } from "../src/Optimizer";
import { TestTemplate } from "./util/TestTemplate";
import clean from "./util/clean";
import { testOptimizationCascade, CascadeTestResult, debugResult } from "./util/assertCascade";
import { TemplateIntegrationOptions, RewritableIdents } from "../src/OpticssOptions";
import { IdentGenerator, IdentGenerators } from "../src/util/IdentGenerator";

function testShareDeclarations(...stylesAndTemplates: Array<string | TestTemplate>): Promise<CascadeTestResult> {
  return testOptimizationCascade(
    { only: ["shareDeclarations"] },
    { rewriteIdents: { id: false, class: true } },
    ...stylesAndTemplates);
}

@suite("Shares Declarations")
export class ShareDeclarationsTest {
  @only
  @test "will share declarations"() {
    let css1 = `
    .thing1 { color: red; }
    .thing2 { border: 1px solid blue; }
    .thing3 { background: red; }
    .thing4 { border-color: blue; color: red; }
  `;
  let template = new TestTemplate("test", clean`
    <div class="(thing3 | thing1)" id="(id1 | id2)"></div>
    <div class="(--- | thing2 | thing4)" id="id3"></div>
  `);
  return testShareDeclarations(css1, template).then(result => {
    let logString = result.optimization.actions.performed[0].logString();
    assert.equal(logString, `${path.resolve("test1.css")}:2:7 [rewriteIdents] Rewrote selector's idents from "#id3" to "#a".`);
    let replaced = Object.keys(result.optimization.styleMapping.replacedAttributes);
    assert.equal(replaced.length, 7);
    // debugResult(css1, result);
  });
  }
}
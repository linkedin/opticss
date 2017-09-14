import { suite, test, skip, only } from "mocha-typescript";
import { assert } from "chai";
import * as path from "path";
import * as postcss from "postcss";

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
    let expectedLogMessage =
      `${path.resolve("test1.css")}:2:15 [shareDeclarations] Declaration moved into generated rule (.a { color: red; }). Duplication 1 of 2.\n` +
      `${path.resolve("test1.css")}:5:35 [shareDeclarations] Declaration moved into generated rule (.a { color: red; }). Duplication 2 of 2.\n` +
      `${path.resolve("test1.css")}:2:5 [shareDeclarations] Removed empty rule with selector ".thing1".`;
    assert.deepEqual(logString, expectedLogMessage);
    assert.deepEqual(clean`${result.optimization.output.content.toString()}`, clean`
      .thing2 { border: 1px solid blue; }
      .thing3 { background: red; }
      .thing4 { border-color: blue; }
      .a { color: red; }`);
    return parseStylesheet(result.optimization.output.content.toString()).then(styles => {
      styles.root!.walkRules(rule => {
        assert(!rule.selector.includes(".thing1"), "Unexpected Selector: .thing1");
      });
    }).then(() => {
      // TODO: verify mapping & template rewrite and cascade.
    });
  });
  }

  @only
  @test "will share shorthand declarations if duplicated"() {
    let css1 = `
    .thing1 { color: red; }
    .thing2 { border: 1px solid blue; }
    .thing3 { border-width: 1px; }
    .thing4 { border-color: blue; color: red; }
    .thing5 { border-style: solid; }
  `;
  let template = new TestTemplate("test", clean`
    <div class="(thing3 | thing1)" id="(id1 | id2)"></div>
    <div class="(--- | thing2 | thing4)" id="id3"></div>
  `);
  return testShareDeclarations(css1, template).then(result => {
    debugResult(css1, result);
    let logString = result.optimization.actions.performed[0].logString();
    let expectedLogMessage =
      `${path.resolve("test1.css")}:2:15 [shareDeclarations] Declaration moved into generated rule (.a { color: red; }). Duplication 1 of 2.\n` +
      `${path.resolve("test1.css")}:5:35 [shareDeclarations] Declaration moved into generated rule (.a { color: red; }). Duplication 2 of 2.\n` +
      `${path.resolve("test1.css")}:2:5 [shareDeclarations] Removed empty rule with selector ".thing1".`;
    assert.deepEqual(logString, expectedLogMessage);
    assert.deepEqual(clean`${result.optimization.output.content.toString()}`, clean`
      .a { color: red; }
      .b { border-width: 1px; }
      .c { border-style: solid; }
      .d { border-color: blue; }`);
    return parseStylesheet(result.optimization.output.content.toString()).then(styles => {
      styles.root!.walkRules(rule => {
        assert(!rule.selector.includes(".thing1"), "Unexpected Selector: .thing1");
      });
    }).then(() => {
      debugResult(css1, result);
      // TODO: verify mapping & template rewrite and cascade.
    });
  });
  }
}

function parseStylesheet(content: string): Promise<postcss.Result> {
  return new Promise<postcss.Result>((resolve, reject) => {
    postcss().process(content, {from: "stylesheet.css"}).then(resolve, reject);
  });
}
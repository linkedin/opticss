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
import { assertSmaller, debugSize } from "./util/assertSmaller";

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
    .a { color: red; }
    .b { border: 1px solid blue; }
    .c { background: red; }
    .d { border-color: blue; color: red; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="(c | a)" id="(id1 | id2)"></div>
    <div class="(--- | b | d)" id="id3"></div>
  `);
    return testShareDeclarations(css1, template).then(result => {
      let logString = result.optimization.actions.performed[0].logString();
      let expectedLogMessage =
        `${path.resolve("test1.css")}:2:10 [shareDeclarations] Declaration moved into generated rule (.e { color: red; }). Duplication 1 of 2.\n` +
        `${path.resolve("test1.css")}:5:30 [shareDeclarations] Declaration moved into generated rule (.e { color: red; }). Duplication 2 of 2.\n` +
        `${path.resolve("test1.css")}:2:5 [shareDeclarations] Removed empty rule with selector ".a".`;
      assert.deepEqual(logString, expectedLogMessage);
      assert.deepEqual(clean`${result.optimization.output.content.toString()}`, clean`
      .b { border: 1px solid blue; }
      .c { background: red; }
      .d { border-color: blue; }
      .e { color: red; }`);
      return parseStylesheet(result.optimization.output.content.toString()).then(styles => {
        styles.root!.walkRules(rule => {
          assert(!rule.selector.includes(".a"), "Unexpected Selector: .a");
        });
      }).then(() => {
        debugResult(css1, result);
        // TODO: verify mapping & template rewrite and cascade.
        return assertSmaller(css1, result, {gzip: { notBiggerThan: 1}});
      });
    });
  }

  @test "will share shorthand declarations if duplicated"() {
    let css1 = `
    .a { color: red; }
    .b { border: 1px solid blue; }
    .c { border-width: 1px; }
    .d { border-color: blue; color: red; }
    .e { border-style: solid; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="(c | a)"></div>
    <div class="(--- | b | d)"></div>
  `);
    return testShareDeclarations(css1, template).then(result => {
      let logString = result.optimization.actions.performed[0].logString();
      let expectedLogMessage =
        `${path.resolve("test1.css")}:2:10 [shareDeclarations] Declaration moved into generated rule (.f { color: red; }). Duplication 1 of 2.\n` +
        `${path.resolve("test1.css")}:5:30 [shareDeclarations] Declaration moved into generated rule (.f { color: red; }). Duplication 2 of 2.\n` +
        `${path.resolve("test1.css")}:2:5 [shareDeclarations] Removed empty rule with selector ".a".`;
      assert.deepEqual(logString, expectedLogMessage);
      assert.deepEqual(clean`${result.optimization.output.content.toString()}`, clean`
      .f { color: red; }
      .g { border-width: 1px; }
      .h { border-style: solid; }
      .i { border-color: blue; }`);
      return parseStylesheet(result.optimization.output.content.toString()).then(styles => {
        styles.root!.walkRules(rule => {
          assert(!rule.selector.includes(".a"), "Unexpected Selector: .a");
        });
      }).then(() => {
        debugSize(css1, result);
        debugResult(css1, result);
        // TODO: verify mapping & template rewrite and cascade.
        return assertSmaller(css1, result);
      });
    });
  }

  @test "will leave duplicated short hands as short hands if nothing to combine with."() {
    let css1 = `
    .a { background: none; }
    .b { background: none; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="(c | a)" id="(id1 | id2)"></div>
    <div class="(--- | b | d)" id="id3"></div>
  `);
    return testShareDeclarations(css1, template).then(result => {
      assert.deepEqual(clean`${result.optimization.output.content.toString()}`, clean`
      .e { background: none; }`);
      return parseStylesheet(result.optimization.output.content.toString()).then(styles => {
        styles.root!.walkRules(rule => {
          assert(!rule.selector.includes(".a"), "Unexpected Selector: .a");
          assert(!rule.selector.includes(".b"), "Unexpected Selector: .a");
        });
      }).then(() => {
        // TODO: verify mapping & template rewrite and cascade.
        return assertSmaller(css1, result);
      });
    });
  }

  @test "expands shorthands if potentially useful"() {
    let css1 = `
    .a { background: none repeat-x fixed content-box red; }
    .f { background-color: red; }
    .a0 { background-image: none; }
    .a1 { background-repeat: repeat-x; }
    .a2 { background-repeat: repeat-x; }
    .a3 { background-clip: content-box; }
    .a4 { background-attachment: fixed; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="(c | a)" id="(id1 | id2)"></div>
    <div class="(--- | b | d)" id="id3"></div>
  `);
    return testShareDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`.a { background-position: initial; background-size: initial; background-origin: content-box; }
              .e { background-image: none; }
              .g { background-repeat: repeat-x; }
              .h { background-clip: content-box; }
              .i { background-attachment: fixed; }
              .j { background-color: red; }`);
      // TODO: verify mapping & template rewrite and cascade.
      return assertSmaller(css1, result, {gzip: { notBiggerThan: 6}, brotli: { notBiggerThan: 1}});
    });
  }

  @skip
  @test "won't merge declarations if they break the cascade."() {
    let css1 = `
    .a { color: red; }
    .b { color: blue; }
    .c { color: red; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="a b"></div>
    <div class="c"></div>
  `);
    return testShareDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`.a { color: red; }
              .b { color: blue; }
              .c { color: red; }`);
      // TODO: verify mapping & template rewrite and cascade.
      return assertSmaller(css1, result, {gzip: { notBiggerThan: 5}});
    });
  }
}

function parseStylesheet(content: string): Promise<postcss.Result> {
  return new Promise<postcss.Result>((resolve, reject) => {
    postcss().process(content, {from: "stylesheet.css"}).then(resolve, reject);
  });
}
import { TestTemplate } from "../../../@opticss/simple-template/src";
import {
  TemplateIntegrationOptions,
  normalizeTemplateOptions,
} from "../../../@opticss/template-api/src";
import {
  assert,
} from "chai";
import {
  skip,
  suite,
  test,
} from "mocha-typescript";
import * as path from "path";
import * as postcss from "postcss";
import { documentToString } from "../../../resolve-cascade/src";

import {
  CascadeTestResult,
  debugCascadeError,
  debugError,
  // debugResult,
  logOptimizations,
  testOptimizationCascade,
} from "../util/assertCascade";
import {
  assertSmaller,
  assertSmallerStylesAndMarkupWithResults,
} from "../util/assertSmaller";
import { clean } from "../util/clean";

function testMergeDeclarations(...stylesAndTemplates: Array<string | TestTemplate>): Promise<CascadeTestResult> {
  return testOptimizationCascade(
    { only: ["mergeDeclarations"] },
    {
      rewriteIdents: { id: true, class: true },
      analyzedAttributes: [],
      analyzedTagnames: true,
    },
    ...stylesAndTemplates,
  );
}

function testMergeDeclarationsWithConfig(
  templateOptions: Partial<TemplateIntegrationOptions>,
  ...stylesAndTemplates: Array<string | TestTemplate>
): Promise<CascadeTestResult> {
  return testOptimizationCascade(
    { only: ["mergeDeclarations"] },
    normalizeTemplateOptions(templateOptions),
    ...stylesAndTemplates);
}

@suite("Declaration Merging")
export class MergeDeclarationsTest {
  @test "will merge declarations"() {
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
    return testMergeDeclarations(css1, template).then(result => {
      let logString = result.optimization.actions.performed[0].logString();
      let expectedLogMessage =
        `${path.resolve("test1.css")}:2:10 [mergeDeclarations] Declaration moved from ".a" into generated rule (.e { color: red; }). Duplication 1 of 2.\n` +
        `${path.resolve("test1.css")}:5:30 [mergeDeclarations] Declaration moved from ".d" into generated rule (.e { color: red; }). Duplication 2 of 2.\n` +
        `${path.resolve("test1.css")}:2:5 [mergeDeclarations] Removed empty rule with selector ".a".`;
      assert.deepEqual(logString, expectedLogMessage);
      assert.deepEqual(clean`${result.optimization.output.content.toString()}`, clean`
      .e { color: red; }
      .b { border: 1px solid blue; }
      .c { background: red; }
      .d { border-color: blue; }`);
      return parseStylesheet(result.optimization.output.content.toString()).then(styles => {
        styles.root!.walkRules(rule => {
          assert(!rule.selector.includes(".a"), "Unexpected Selector: .a");
        });
      }).then(() => {
        // debugResult(css1, result);
        // fails because it's the same size >_<
        // return assertSmaller(css1, result, { gzip: { atLeastSmallerThan: -1 } });
      }).catch(e => {
        debugError(css1, e);
        throw e;
      });
    });
  }

  @test "won't merge shorthand declarations with intervening conflicts"() {
    let css1 = `
    .a { color: red; }
    .b { border: 1px solid blue; }
    .f { border-style: dashed; }
    .c { border-width: 1px; }
    .d { border-color: blue; color: red; }
    .e { border-style: solid; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="(c | a)"></div>
    <div class="(--- | b | d)"></div>
    <div class="e f"></div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      let logString = result.optimization.actions.performed[0].logString();
      let expectedLogMessage =
        `${path.resolve("test1.css")}:4:10 [mergeDeclarations] ` +
        `Couldn't merge .e { border-style: solid; } (at ${path.resolve("test1.css")}:7:10) ` +
        `with .b { border: 1px solid blue; } (at ${path.resolve("test1.css")}:3:10) ` +
        `because it conflicts with .f { border-style: dashed; } on element <div class="e f">`;
      assert.deepEqual(logString, expectedLogMessage);
      assert.deepEqual(clean`${result.optimization.output.content.toString()}`, clean`
        .g { color: red; }
        .b { border: 1px solid blue; }
        .f { border-style: dashed; }
        .c { border-width: 1px; }
        .d { border-color: blue; }
        .e { border-style: solid; }`);
      return parseStylesheet(result.optimization.output.content.toString()).then(styles => {
        styles.root!.walkRules(rule => {
          assert(!rule.selector.includes(".a"), "Unexpected Selector: .a");
        });
      }).then(() => {
        // debugSize(css1, result);
        // debugResult(css1, result);
      });
    });
  }

  @test "will merge shorthand declarations if duplicated"() {
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
    return testMergeDeclarations(css1, template).then(result => {
      assert.deepEqual(clean`${result.optimization.output.content.toString()}`, clean`
      .f { color: red; }
      .g { border-width: 1px; }
      .i { border-color: blue; }
      .h { border-style: solid; }`);
      return parseStylesheet(result.optimization.output.content.toString()).then(styles => {
        styles.root!.walkRules(rule => {
          assert(!rule.selector.includes(".a"), "Unexpected Selector: .a");
        });
      }).then(() => {
        // debugSize(css1, result);
        // debugResult(css1, result);
        // return assertSmaller(css1, result);
      });
    });
  }

  @test "will leave duplicated short hands as short hands if nothing to combine with"() {
    let css1 = `
    .a { background: none; }
    .b { background: none; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="(c | a)" id="(id1 | id2)"></div>
    <div class="(--- | b | d)" id="id3"></div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
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
    <div class="(a | c)"></div>
    <div class="(--- | b | d)"></div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`.e { background-image: none; }
              .g { background-repeat: repeat-x; }
              .h { background-clip: content-box; }
              .i { background-attachment: fixed; }
              .j { background-color: red; }
              .a { background-position: 0% 0%; background-size: auto auto; background-origin: content-box; }`);
      assert.deepEqual(documentToString(result.testedTemplates[0].assertionResults[0].actualDoc), clean`
        <div class="a e g h i j"></div>
        <div></div>`);
    });
  }

  @test "won't merge declarations if they break the cascade."() {
    let css1 = `
    .a { color: red; }
    .b { color: blue; }
    .c { color: red; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="a"></div>
    <div class="b c"></div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`.a { color: red; }
              .b { color: blue; }
              .c { color: red; }`);
      return assertSmaller(css1, result, { uncompressed: { notBiggerThan: 1 }, gzip: { notBiggerThan: 5 }, brotli: { notBiggerThan: 1 } });
    });
  }

  @test "won't merge shorthand declarations if they break the cascade."() {
    let css1 = `
    .aa { background: none repeat-x fixed content-box red; }
    .bb { background-color: red; }
    .cc { background-image: none; }
    .zz { background-attachment: static; }
    .dd { background-repeat: repeat-x; }
    .ee { background-repeat: repeat-x; }
    .ff { background-clip: content-box; }
    .gg { background-attachment: fixed; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="zz gg"></div>
    <div class="aa bb cc"></div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .aa { background: none repeat-x fixed content-box red; }
          .bb { background-color: red; }
          .cc { background-image: none; }
          .zz { background-attachment: static; }
          .a { background-repeat: repeat-x; }
          .ff { background-clip: content-box; }
          .gg { background-attachment: fixed; }
        `);
      return assertSmaller(css1, result, { uncompressed: { notBiggerThan: 1 }, gzip: { notBiggerThan: 5 }, brotli: { notBiggerThan: 2 } });
    }).catch(e => {
      debugError(css1, e);
      throw e;
    });
  }

  @test "handles media queries"() {
    let css1 = clean`
    .a { color: red; }
    @media (min-device-width: 500px) {
      .a { color: blue; }
    }
    .c { color: red; }
    @media (min-device-width: 500px) {
      .c { color: blue; }
    }
  `;
    let template = new TestTemplate("test", clean`
    <div class="a b"></div>
    <div class="c"></div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .d { color: red; }
          @media (min-device-width: 500px) {
            .e { color: blue; }
          }
        `);
      assert.deepEqual(documentToString(result.testedTemplates[0].assertionResults[0].actualDoc), clean`
        <div class="d e b"></div>
        <div class="d e"></div>
      `);
      // return assertSmaller(css1, result, {gzip: {notBiggerThan: 1}, brotli: {notBiggerThan: 8}});
    });
  }

  @test "handles media queries with conflict"() {
    let css1 = clean`
    .a { color: red; }
    @media (min-device-width: 500px) {
      .a { color: blue; }
    }
    .c { color: red; }
    @media (min-device-width: 500px) {
      .c { color: blue; }
    }
  `;
    let template = new TestTemplate("test", clean`
    <div class="b"></div>
    <div class="a c"></div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(documentToString(result.testedTemplates[0].assertionResults[0].actualDoc), clean`
        <div class="b"></div>
        <div class="a c"></div>
      `);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .a { color: red; }
          @media (min-device-width: 500px) {
            .a { color: blue; }
          }
          .c { color: red; }
          @media (min-device-width: 500px) {
            .c { color: blue; }
          }
        `);
    });
  }

  @test "is pseudo class scoped"() {
    let css1 = clean`
    .aa { color: red; }
    .aa:hover { color: white; }
    .bb { color: white; }
    .cc { color: red; }
    .cc:hover { color: white; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="aa"></div>
    <div class="bb cc"></div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        result.optimization.output.content.toString().trim(),
        clean`
          .aa { color: red; }
          .a:hover { color: white; }
          .bb { color: white; }
          .cc { color: red; }
        `);
      return assertSmaller(css1, result, { gzip: { notBiggerThan: 1 }, brotli: { notBiggerThan: 8 } });
    }).catch(e => {
      debugError(css1, e);
      throw e;
    });
  }

  // TODO: Tune hueristic about when to merge decls when nested.
  @test "handles simple scoped selectors"() {
    let css1 = clean`
    .a .c { color: blue; float: right; }
    .a .d { color: blue; float: left; }
    .a .e { color: blue; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="a">
      <span class="c">C Scoped!</span>
      <span class="d">D Scoped!</span>
      <span class="e">C Scoped!</span>
    </div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .a .b { color: blue; }
          .a .c { float: right; }
          .a .d { float: left; }
        `);
      return assertSmaller(css1, result, { gzip: { notBiggerThan: 1 }, brotli: { notBiggerThan: 1 } });
    });
  }
  @test "merges psuedoclasses safely"() {
    let css1 = clean`
    .bip { color: blue; }
    .foo:hover { color: red; }
    .bar:hover { color: red; }
    .baz { color: blue; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="foo"></div>
    <div class="bar"></div>
    <div class="bip"></div>
    <div class="baz"></div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .a { color: blue; }
          .b:hover { color: red; }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="b"></div>
          <div class="b"></div>
          <div class="a"></div>
          <div class="a"></div>
        `);
    }).catch((e) => {
      debugCascadeError(e);
      throw e;
    });
  }
  @test "merges chained psuedos with different orders"() {
    let css1 = clean`
    .foo:hover:first-of-type { color: red; }
    .bar:first-of-type:hover { color: red; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="foo"></div>
    <div class="bar"></div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .a:first-of-type:hover { color: red; }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="a"></div>
          <div class="a"></div>
        `);
    }).catch((e) => {
      debugCascadeError(e);
      throw e;
    });
  }
  @test "handles cascade conflicts with pseudos"() {
    let css1 = clean`
    .foo:hover { color: red; }
    .bip.baz { color: green; }
    .bar:hover { color: red; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="foo"></div>
    <div class="bar bip baz"></div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .foo:hover { color: red; }
          .bip.baz { color: green; }
          .bar:hover { color: red; }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="foo"></div>
          <div class="bar baz bip"></div>
        `);
    }).catch((e) => {
      debugCascadeError(e);
      throw e;
    });
  }
  @test "merges psuedoclasses with cascade overrides"() {
    let css1 = clean`
    .foo { color: blue; }
    .foo:hover { color: red; }
    .bar { color: blue; }
    .bar:hover { color: red; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="foo"></div>
    <div class="bar"></div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      // TODO: This should really re-use the class `.a` in the hover selector.
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .a { color: blue; }
          .b:hover { color: red; }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="a b"></div>
          <div class="a b"></div>
        `);
    }).catch((e) => {
      debugCascadeError(e);
      throw e;
    });
  }
  @test "handles duplicated declarations with rules with multiple selectors"() {
    let css1 = clean`
    .foo, .bar { color: red; }
    .baz { color: red; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="foo"></div>
    <div class="bar"></div>
    <div class="baz"></div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .a { color: red; }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="a"></div>
          <div class="a"></div>
          <div class="a"></div>
        `);
    }).catch((e) => {
      debugCascadeError(e);
      throw e;
    });
  }
  @test "handles shorthands in rulesets with multiple selectors that merge differently in different scopes."() {
    let css1 = clean`
    .scope .b5 { background-position: center; }
    .scope .b0 { background-image: none; }
    .scope .b1 { background-repeat: repeat-x; }
    .scope .b2 { background-repeat: repeat-x; }
    .scope .b3 { background-clip: content-box; }
    .scope .b4 { background-attachment: fixed; }
    .scope .shBg, .shortBg { background: none center repeat-x fixed content-box red; }
    .a5 { background-color: red; }
    .a0 { background-image: none; }
    .a1 { background-repeat: repeat-x; }
    .a2 { background-repeat: repeat-x; }
    .a3 { background-clip: content-box; }
    .a4 { background-attachment: fixed; }
    `;
    let template = new TestTemplate("test", clean`
      <div class="scope">
        <div class="b0 b1 b2 b3 b4 b5"></div>
        <div class="shBg"></div>
      </div>
      <div class="a0 a1 a2 a3 a4 a5"></div>
      <div class="shortBg"></div>
    `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
        .scope .a { background-position: center; }
        .scope .b { background-image: none; }
        .scope .c { background-repeat: repeat-x; }
        .scope .d { background-clip: content-box; }
        .scope .e { background-attachment: fixed; }
        .f { background-image: none; }
        .g { background-repeat: repeat-x; }
        .h { background-clip: content-box; }
        .i { background-attachment: fixed; }
        .j { background-color: red; }
        .scope .shBg, .shortBg { background-size: auto auto; background-origin: content-box; background-color: red; background-position: center; }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
        <div class="scope">
        <div class="b c d e a"></div>
        <div class="shBg a b c d e"></div>
        </div>
        <div class="f g h i j"></div>
        <div class="shortBg f g h i j"></div>
        `);
    }).catch((e) => {
      debugCascadeError(e);
      throw e;
    });
  }
  @test "handles shorthands in rulesets with multiple selectors in diff scopes with one fully merged."() {
    let css1 = clean`
    .scope .b5 { background-position: center; }
    .scope .b0 { background-image: none; }
    .scope .b1 { background-repeat: repeat-x; }
    .scope .b2 { background-repeat: repeat-x; }
    .scope .b3 { background-clip: content-box; }
    .scope .b4 { background-attachment: fixed; }
    .scope .shBg, .shortBg { background: none center repeat-x fixed content-box red; }
    .a0 { background-image: none; }
    .a1 { background-repeat: repeat-x; }
    .a2 { background-repeat: repeat-x; }
    .a3 { background-clip: content-box; }
    .a4 { background-attachment: fixed; }
    .a5 { background-color: red; }
    .a6 { background-position: center; }
    .a7 { background-size: auto auto; }
    .a8 { background-origin: content-box; }
    `;
    let template = new TestTemplate("test", clean`
      <div class="scope">
        <div class="b0 b1 b2 b3 b4 b5"></div>
        <div class="shBg"></div>
      </div>
      <div class="a0 a1 a2 a3 a4 a5 a6 a7"></div>
      <div class="shortBg"></div>
    `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
        .scope .a { background-position: center; }
        .scope .b { background-image: none; }
        .scope .c { background-repeat: repeat-x; }
        .scope .d { background-clip: content-box; }
        .scope .e { background-attachment: fixed; }
        .f { background-image: none; }
        .g { background-position: center; }
        .h { background-size: auto auto; }
        .i { background-repeat: repeat-x; }
        .j { background-origin: content-box; }
        .k { background-clip: content-box; }
        .l { background-attachment: fixed; }
        .m { background-color: red; }
        .scope .shBg { background-size: auto auto; background-origin: content-box; background-color: red; }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
        <div class="scope">
        <div class="b c d e a"></div>
        <div class="shBg a b c d e"></div>
        </div>
        <div class="f i k l m g h"></div>
        <div class="f g h i j k l m"></div>
        `);
    }).catch((e) => {
      debugCascadeError(e);
      throw e;
    });
  }
  @test "handles declarations with rules with multiple selector scopes"() {
    let css1 = clean`
    .scope1 .foo, .scope2 .bar { color: red; }
    .scope1 .red { color: red; }
    .scope2 .red { color: red; }
    `;
    let template = new TestTemplate("test", clean`
      <div class="scope1">
        <div class="foo"></div>
        <div class="red"></div>
      </div>
      <div class="scope2">
        <div class="bar"></div>
        <div class="red"></div>
      </div>
    `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .scope1 .a { color: red; }
          .scope2 .b { color: red; }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="scope1">
            <div class="a"></div>
            <div class="a b"></div>
          </div>
          <div class="scope2">
            <div class="b"></div>
            <div class="a b"></div>
          </div>
        `);
    }).catch((e) => {
      debugCascadeError(e);
      throw e;
    });
  }
  @test "handles rules with multiple selectors"() {
    let css1 = clean`
    .foo, .bar { color: red; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="foo"></div>
    <div class="bar"></div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .a { color: red; }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="a"></div>
          <div class="a"></div>
        `);
    }).catch((e) => {
      debugError(css1, e);
      throw e;
    });
  }
  @test "flex test"() {
    let css1 = clean`
    .a.b {
        flex: 0 1 auto;
    }
    .d {
      display: inline-block;
      flex: 0 0 auto;
    }
    .c.d {
      flex: 0 1 auto;
    }
  `;
    let template = new TestTemplate("test", clean`
    <div class="a b">
    <div class="c d">
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .a.b {
            flex: 0 1 auto;
          }
          .d {
           display: inline-block;
           flex: 0 0 auto;
          }
          .c.d {
           flex: 0 1 auto;
          }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="a b">
          <div class="c d"></div></div>
        `);
    }).catch((e) => {
      debugError(css1, e);
      throw e;
    });
  }
  // TODO: should this merge `.bar` with `.red` and remove the `.bar` selector
  // from the shared rule set?
  @test "handles rules with multiple selectors where only one can be merged"() {
    let css1 = clean`
    .scope .foo, .bar { color: red; }
    .red { color: red; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="bar"></div>
    <div class="scope"><div class="foo"></div></div>
    <div class="red"></div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .scope .foo, .bar { color: red; }
          .red { color: red; }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="bar"></div>
          <div class="scope"><div class="foo"></div></div>
          <div class="red"></div>
        `);
    }).catch((e) => {
      debugError(css1, e);
      throw e;
    });
  }

  @test "handles shorthand with longhand override"() {
    // must ensure that the order of progressive enhancement declarations
    // is preserved.
    let css = clean`
      .duplicate-override {
        border-top-color: #ccc;
      }
      .duplicate-shorthand {
        border-top: 1px solid red;
      }
      .duplicate-longhand {
        border-top-color: red;
      }
      .has-override {
        /* progressive enhancement */
        border-top: 1px solid red;
        border-top-color: #ccc;
      }
    `;
    let template = new TestTemplate("test", clean`
      <div class="duplicate-override"></div>
      <div class="duplicate-shorthand"></div>
      <div class="duplicate-longhand"></div>
      <div class="has-override"></div>
    `);
    return testMergeDeclarations(css, template).then(result => {
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .duplicate-override {
            border-top-color: #ccc;
          }
          .a { border-top-color: red; }
          .b { border-top-width: 1px; }
          .c { border-top-style: solid; }
          .has-override {
            /* progressive enhancement */
            border-top-color: #ccc;
          }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="duplicate-override"></div>
          <div class="a b c"></div>
          <div class="a"></div>
          <div class="has-override a b c"></div>
        `);
    }).catch((e) => {
      // logOptimizations(e.optimization);
      // debugCascadeError(e);
      throw e;
    });
  }
  @test "handles shorthand with longhand override partial shorthand merge expansion"() {
    // must ensure that the order of progressive enhancement declarations
    // is preserved.
    let css = clean`
      .duplicate-override {
        border-top-color: #ccc;
        border-bottom-color: #ccc;
        border-left-color: #ccc;
        border-right-color: #ccc;
      }
      .duplicate-shorthand {
        border-width: 1px;
        border-style: solid;
        border-top-color: red;
        border-bottom-color: red;
        border-left-color: red;
      }
      .has-override {
        /* progressive enhancement */
        border: 1px solid red;
        border-color: #ccc;
      }
    `;
    let template = new TestTemplate("test", clean`
      <div class="duplicate-override"></div>
      <div class="duplicate-shorthand"></div>
      <div class="has-override"></div>
    `);
    return testMergeDeclarations(css, template).then(result => {
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .duplicate-override {
            border-top-color: #ccc;
            border-bottom-color: #ccc;
            border-left-color: #ccc;
            border-right-color: #ccc;
          }
          .a { border-top-color: red; }
          .b { border-bottom-color: red; }
          .c { border-left-color: red; }
          .d { border-width: 1px; }
          .e { border-style: solid; }
          .has-override {
            /* progressive enhancement */ border-right-color: red;
            border-color: #ccc;
          }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="duplicate-override"></div>
          <div class="a b c d e"></div>
          <div class="has-override a b c d e"></div>
        `);
    }).catch((e) => {
      debugCascadeError(e);
      throw e;
    });
  }
  @test "handles shorthand with longhand override partial shorthand merge expansion again"() {
    // must ensure that the order of progressive enhancement declarations
    // is preserved.
    let css = clean`
      .tc1 {
        border-top-color: #ccc;
      }
      .tc2 {
        border-bottom-color: #ccc;
      }
      .tc3 {
        border-width: 1px;
      }
      .tc4 {
        border-style: solid;
      }
      .gc1 {
        border-color: #aaa;
      }
      .has-override {
        /* progressive enhancement */
        border: 1px solid #ccc;
        border-color: #aaa;
      }
    `;
    let template = new TestTemplate("test", clean`
      <div class="tc1 tc2"></div>
      <div class="tc3 tc4"></div>
      <div class="has-override"></div>
    `);
    return testMergeDeclarations(css, template).then(result => {
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
        .a { border-top-color: #ccc; }
        .b { border-bottom-color: #ccc; }
        .c { border-width: 1px; }
        .d { border-style: solid; }
        .gc1 {
          border-color: #aaa;
        }
        .has-override {
          /* progressive enhancement */ border-left-color: #ccc; border-right-color: #ccc;
          border-color: #aaa;
        }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="a b"></div>
          <div class="c d"></div>
          <div class="has-override a b c d"></div>
        `);
    }).catch((e) => {
      debugCascadeError(e);
      throw e;
    });
  }
  @test "handles shorthand with longhand override only one merged"() {
    // must ensure that the order of progressive enhancement declarations
    // is preserved.
    let css = clean`
      .duplicate-override {
        border-top-color: rgba(127, 0, 0, 0.3);
      }
      .has-override {
        /* progressive enhancement */
        border-top: 1px solid red;
        border-top-color: rgba(127, 0, 0, 0.3);
      }
    `;
    let template = new TestTemplate("test", clean`
      <div class="duplicate-override"></div>
      <div class="has-override"></div>
    `);
    return testMergeDeclarations(css, template).then(result => {
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .duplicate-override {
            border-top-color: rgba(127, 0, 0, 0.3);
          }
          .has-override {
            /* progressive enhancement */
            border-top: 1px solid red;
            border-top-color: rgba(127, 0, 0, 0.3);
          }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="duplicate-override"></div>
            <div class="has-override"></div>
        `);
    }).catch((e) => {
      logOptimizations(e.optimization);
      debugCascadeError(e);
      throw e;
    });
  }
  @test "handles id selectors"() {
    let css1 = clean`
    #id1 { color: blue; float: right; }
    #id2 { color: blue; float: left; }
    #id3 { color: blue; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="a">
      <span id="id1">id 1</span>
      <span id="id2">id 2</span>
      <span id="id3">id 3</span>
    </div>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .b { color: blue; }
          #id1 { float: right; }
          #id2 { float: left; }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="a">
          <span id="id1" class="b">id 1</span>
          <span id="id2" class="b">id 2</span>
          <span class="b">id 3</span>
          </div>
        `);
      return assertSmaller(css1, result, { gzip: { notBiggerThan: 1 }, brotli: { notBiggerThan: 5 } });
    }).catch((e) => {
      debugCascadeError(e);
      throw e;
    });
  }
  @test "handles id selectors when ids are analyzed but rewriting is off"() {
    let css1 = clean`
      #id1 { color: blue; float: right; }
      #id2 { color: blue; float: left; }
      #id3 { color: blue; }
    `;
    let template = new TestTemplate("test", clean`
      <div class="a">
        <span id="id1">id 1</span>
        <span id="id2">id 2</span>
        <span id="id3">id 3</span>
      </div>
    `);
    let templateConfig: Partial<TemplateIntegrationOptions> = {
      rewriteIdents: { id: false, class: true },
      analyzedAttributes: ["id"],
    };
    return testMergeDeclarationsWithConfig(templateConfig, css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .b { color: blue; }
          #id1 { float: right; }
          #id2 { float: left; }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="a">
          <span id="id1" class="b">id 1</span>
          <span id="id2" class="b">id 2</span>
          <span id="id3" class="b">id 3</span>
          </div>
        `,
        "The id attribute should not be removed.");
      // return assertSmaller(css1, result, {gzip: {notBiggerThan: 1}, brotli: {notBiggerThan: 1}});
    }).catch((e) => {
      debugError(css1, e);
      throw e;
    });
  }
  @test "ignores id selectors when ids aren't analyzed and rewriting is off"() {
    let css1 = clean`
      #id1 { color: blue; float: right; }
      #id2 { color: blue; float: left; }
      #id3 { color: blue; }
    `;
    let template = new TestTemplate("test", clean`
      <div class="a">
        <span id="id1">id 1</span>
        <span id="id2">id 2</span>
        <span id="id3">id 3</span>
      </div>
    `);
    let templateConfig: Partial<TemplateIntegrationOptions> = {
      rewriteIdents: { id: false, class: true },
      analyzedAttributes: [],
    };
    return testMergeDeclarationsWithConfig(templateConfig, css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          #id1 { color: blue; float: right; }
          #id2 { color: blue; float: left; }
          #id3 { color: blue; }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="a">
          <span id="id1">id 1</span>
          <span id="id2">id 2</span>
          <span id="id3">id 3</span>
          </div>
        `,
        "No optimization should have occurred.");
      // return assertSmaller(css1, result, {gzip: {notBiggerThan: 1}, brotli: {notBiggerThan: 1}});
    }).catch((e) => {
      debugError(css1, e);
      throw e;
    });
  }
  @test "merges from other analyzed attributes and tag names into classes"() {
    let css1 = clean`
      .field { float: left; }
      input[type=text] { float: left; }
      input[disabled] { background-color: gray; }
      .label { background-color: gray; }
    `;
    let template = new TestTemplate("test", clean`
      <div class="field">
        <label for="name-field" class="label">First Name:</label>
        <input id="name-field" type="text" disabled>
      </div>
    `);
    let templateConfig: Partial<TemplateIntegrationOptions> = {
      rewriteIdents: { id: false, class: true },
      analyzedAttributes: ["disabled", "type"],
    };
    return testMergeDeclarationsWithConfig(templateConfig, css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .a { float: left; }
          .b { background-color: gray; }
        `);
      assert.deepEqual(
        documentToString(result.testedTemplates[0].assertionResults[0].actualDoc),
        clean`
          <div class="a">
          <label for="name-field" class="b">First Name:</label>
          <input id="name-field" type="text" disabled="" class="a b">
          </div>
        `);
      // return assertSmaller(css1, result, {gzip: {notBiggerThan: 1}, brotli: {notBiggerThan: 1}});
    }).catch((e) => {
      debugError(css1, e);
      throw e;
    });
  }

  // TODO merge classes when specificity would override them
  // and the element(s) already have the class.
  @skip
  @test "handles scoped selectors"() {
    let css1 = clean`
    .c { color: red; float: left; }
    .d { color: red; float: right; }
    .a .c { color: blue; float: right; }
    .a .d { color: blue; float: left; }
    .b > .c { color: purple; float: none; }
    .b > .d { color: purple; float: none; }
    .e .b > .c { float: left;}
    .e .b > .d { float: left;}
  `;
    let template = new TestTemplate("test", clean`
    <div class="a">
      <span class="c">C Scoped!</span>
      <span class="d">D Scoped!</span>
    </div>
    <div class="e">
      <div class="b">
        <span class="c">C Scoped!</span>
        <span class="d">D Scoped!</span>
      </div>
    </div>
    <span class="c">C Not Scoped!</span>
    <span class="d">D Not Scoped!</span>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .f { color: red; }
          .c { float: left; }
          .d { float: right; }
          .a .f { color: blue; }
          .a .c { float: right; }
          .a .d { float: left; }
          .b > .f { color: purple; }
          .b > .g { float: none; }
          .e .b > .g { float: left; }
        `);
      return assertSmaller(css1, result, { gzip: { atLeastSmallerThan: 0 }, brotli: { atLeastSmallerThan: 0 } });
    });
  }

  // TODO merge classes when specificity would override them
  // and the element(s) already have the class.
  @skip
  @test "handles scoped selectors with additional scoped mergeable decls"() {
    let css1 = clean`
    .c { color: red; float: left; }
    .d { color: red; float: right; }
    .a .c { color: blue; float: right; }
    .a .d { color: blue; float: left; }
    .a .e { color: blue; }`;
    let template = new TestTemplate("test", clean`
    <div class="a">
      <span class="c">C Scoped!</span>
      <span class="d">D Scoped!</span>
      <span class="e">E Scoped!</span>
    </div>
    <span class="c">C Not Scoped!</span>
    <span class="d">D Not Scoped!</span>
    <span class="e">E Not Scoped!</span>
  `);
    return testMergeDeclarations(css1, template).then(result => {
      // debugResult(css1, result);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .f { color: red; }
          .c { float: left; }
          .d { float: right; }
          .a .f { color: blue; }
          .a .c { float: right; }
          .a .d { float: left; }
        `);
      return assertSmaller(css1, result, { gzip: { atLeastSmallerThan: 0 }, brotli: { atLeastSmallerThan: 0 } });
    });
  }

  @skip
  @test "check sizes"() {
    let inputCSS = clean`
    .c { color: red; float: left; }
    .d { color: red; float: right; }
    .a .c { color: blue; float: right; }
    .a .d { color: blue; float: left; }
    .a .e:matches(.e) { color: blue; }`;
    let inputHTML = clean`
    <div class="a">
      <span class="c">C Scoped!</span>
      <span class="d">D Scoped!</span>
      <span class="e">E Scoped!</span>
    </div>
    <span class="c">C Not Scoped!</span>
    <span class="d">D Not Scoped!</span>
    <span class="e">E Not Scoped!</span>`;
    let outputCSS = clean`
    .f { color: red; }
    .c { float: left; }
    .d { float: right; }
    .a :matches(.e, .f) { color: blue; }
    .a .c { float: right; }
    .a .d { float: left; }
    `;
    let outputHTML = clean`
    <div class="a">
      <span class="c f">C Scoped!</span>
      <span class="d f">D Scoped!</span>
      <span class="e">E Scoped!</span>
    </div>
    <span class="c f">C Not Scoped!</span>
    <span class="d f">D Not Scoped!</span>
    <span class="e">E Not Scoped!</span>`;
    return assertSmallerStylesAndMarkupWithResults(
      inputCSS, outputCSS, inputHTML, outputHTML,
    ).then(([cssDelta, markupDelta]) => {
      // tslint:disable-next-line:no-console
      console.log("CSS Delta:\n", cssDelta);
      // tslint:disable-next-line:no-console
      console.log("Markup Delta:\n", markupDelta);
    });
  }
}

function parseStylesheet(content: string): Promise<postcss.Result> {
  return new Promise<postcss.Result>((resolve, reject) => {
    postcss().process(content, { from: "stylesheet.css" }).then(resolve, reject);
  });
}

import {
  assert,
} from 'chai';
import {
  skip,
  suite,
  test,
} from 'mocha-typescript';
import * as path from 'path';
import * as postcss from 'postcss';
import {
  documentToString,
} from 'resolve-cascade';

import {
  CascadeTestResult,
  debugError,
  testOptimizationCascade,
} from './util/assertCascade';
import {
  assertSmaller as assertSmallerUtil,
  assertSmallerStylesAndMarkup,
  DeltaAssertions,
} from './util/assertSmaller';
import clean from './util/clean';
import {
  TestTemplate,
} from './util/TestTemplate';

function testMergeDeclarations(...stylesAndTemplates: Array<string | TestTemplate>): Promise<CascadeTestResult> {
  return testOptimizationCascade(
    { only: ["mergeDeclarations"] },
    { rewriteIdents: { id: false, class: true } },
    ...stylesAndTemplates);
}

function assertSmaller(
  inputCSS: string,
  result: CascadeTestResult,
  assertions?: DeltaAssertions
): Promise<void> {
  return assertSmallerUtil(inputCSS, result, assertions).then(() => {});
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
        return assertSmaller(css1, result, {gzip: { notBiggerThan: 1}});
      }).catch(e => {
        debugError(css1, e);
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
              .a { background-position: initial; background-size: initial; background-origin: content-box; }`);
      assert.deepEqual(documentToString(result.testedTemplates[0].assertionResults[0].actualDoc), clean`
        <body><div class="a e g h i j"></div>
        <div></div></body>`);
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
      return assertSmaller(css1, result, {uncompressed: {notBiggerThan: 1}, gzip: { notBiggerThan: 5}, brotli: { notBiggerThan: 1}});
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
      return assertSmaller(css1, result, {uncompressed: {notBiggerThan: 1}, gzip: { notBiggerThan: 5}, brotli: { notBiggerThan: 2}});
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
      assert.deepEqual(documentToString(result.testedTemplates[0].assertionResults[0].actualDoc), clean`
        <body><div class="d e b"></div>
        <div class="d e"></div></body>
      `);
      assert.deepEqual(
        clean`${result.optimization.output.content.toString()}`,
        clean`
          .d { color: red; }
          @media (min-device-width: 500px) {
            .e { color: blue; }
          }
        `);
      return assertSmaller(css1, result, {gzip: {notBiggerThan: 1}, brotli: {notBiggerThan: 8}});
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
        <body><div class="b"></div>
        <div class="a c"></div></body>
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
      return assertSmaller(css1, result, {gzip: {notBiggerThan: 1}, brotli: {notBiggerThan: 8}});
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
      return assertSmaller(css1, result, {gzip: {notBiggerThan: 1}, brotli: {notBiggerThan: 1}});
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
      return assertSmaller(css1, result, {gzip: {atLeastSmallerThan: 0}, brotli: {atLeastSmallerThan: 0}});
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
      return assertSmaller(css1, result, {gzip: {atLeastSmallerThan: 0}, brotli: {atLeastSmallerThan: 0}});
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
    return assertSmallerStylesAndMarkup(
      inputCSS, outputCSS, inputHTML, outputHTML
    ).then(([cssDelta, markupDelta]) => {
      console.log("CSS Delta:\n", cssDelta);
      console.log("Markup Delta:\n", markupDelta);
    });
  }
}

function parseStylesheet(content: string): Promise<postcss.Result> {
  return new Promise<postcss.Result>((resolve, reject) => {
    postcss().process(content, {from: "stylesheet.css"}).then(resolve, reject);
  });
}
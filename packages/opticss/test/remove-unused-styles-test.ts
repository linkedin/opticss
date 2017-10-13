import * as path from 'path';

import { assert } from 'chai';
import { suite, test } from 'mocha-typescript';
import { TemplateAnalysis } from '@opticss/template-api';
import { SimpleAnalyzer, TestTemplate } from '@opticss/simple-template';

import { ChangeSelector, RemoveRule } from '../src/Actions';
import { OptimizationResult, Optimizer } from '../src/Optimizer';
import clean from './util/clean';

function testRemoveUnusedStyles(stylesAndTemplates: Array<string | TestTemplate>, expectedOutput: string): Promise<OptimizationResult> {
  let optimizer = new Optimizer({
    only: ["removeUnusedStyles"]
  },
  { rewriteIdents: { id: false, class: true }});
  let nCss = 1;
  let analysisPromises = new Array<Promise<TemplateAnalysis<"TestTemplate">>>();
  stylesAndTemplates.forEach(styleOrTemplate => {
    if (typeof styleOrTemplate === "string") {
      optimizer.addSource({ content: styleOrTemplate, filename: `test${nCss++}.css` });
    } else {
      let analyzer = new SimpleAnalyzer(styleOrTemplate);
      analysisPromises.push(analyzer.analyze());
    }
  });
  return Promise.all(analysisPromises).then(analyses => {
    analyses.forEach(a => {
      optimizer.addAnalysis(a);
    });
  }).then(() => {
    return optimizer.optimize("optimized.css").then(result => {
      let optimized = result.output.content.toString();
      assert.equal(optimized, expectedOutput);
      return result;
    });
  });
}

@suite("Unused style removal")
export class RemoveUnusedStylesTest {
  @test "Removes unused class"() {
    let css1 = `.a { color: red; }`;
    let css2 = `.b { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="b"></div>
    `);
    let expectedCss = `\n${css2}`;
    return testRemoveUnusedStyles([css1, css2, template], expectedCss);
  }
  @test "Removes unused selector with used class in context selector"() {
    let css1 = `.b .a { color: red; }`;
    let css2 = `.b { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="b"></div>
    `);
    let expectedCss = `\n${css2}`;
    return testRemoveUnusedStyles([css1, css2, template], expectedCss);
  }
  @test "Removes used class with unused class in context selector"() {
    let css1 = `.a { color: red; }`;
    let css2 = `.a .b { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="b"></div>
    `);
    let expectedCss = `\n`;
    return testRemoveUnusedStyles([css1, css2, template], expectedCss);
  }
  @test "Handles :not() in removal"() {
    let css1 = `.a { color: red; }`;
    let css2 = `:not(.a) .b { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="b"></div>
    `);
    let expectedCss = `\n${css2}`;
    return testRemoveUnusedStyles([css1, css2, template], expectedCss);
  }

  @test "Considers tag names in dead selector removal (keeps)"() {
    let css1 = `.a { color: red; }`;
    let css2 = `div.b { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="b"></div>
    `);
    let expectedCss = `\n${css2}`;
    return testRemoveUnusedStyles([css1, css2, template], expectedCss);
  }

  @test "Considers tag names in dead selector removal (removes)"() {
    let css1 = `.a { color: red; }`;
    let css2 = `span.b { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="b"></div>
    `);
    let expectedCss = `\n`;
    return testRemoveUnusedStyles([css1, css2, template], expectedCss);
  }
  @test "Removes selectors for doubled classes when one is missing"() {
    let css = `.a.b { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="b"></div>
    `);
    let expectedCss = ``;
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Removes selectors for doubled classes when one is missing even if both exist in the template"() {
    let css = `.a.b { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="a"><span class="b">test</span></div>
    `);
    let expectedCss = ``;
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Doesn't removes selectors for doubled classes when both are present together"() {
    let css = `.a.b { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="a b"></div>
    `);
    let expectedCss = css;
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Removes selectors from a selector list"() {
    let css = `.c, .a.b { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="b c"></div>
    `);
    let expectedCss = `.c { width: 100%; }`;
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Doesn't remove selectors that might be used dynamically"() {
    let css = `.c, .a.b { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="b (a | c)"></div>
    `);
    let expectedCss = css;
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Removes selectors that are not used in any dynamic combination"() {
    let css = `.a.b { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="(a d | b c)"></div>
    `);
    let expectedCss = "";
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Removes unused id selectors"() {
    let css = `#id, .a { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="a"></div>
    `);
    let expectedCss = ".a { width: 100%; }";
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Keeps used id selectors"() {
    let css = `#id, .a { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="a"></div><div id="id"></div>
    `);
    let expectedCss = css;
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Removes unused combinations of used ids and classes"() {
    let css = `#id.a { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="a"></div><div id="id"></div>
    `);
    let expectedCss = "";
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Keeps selectors if they might match at the beginning"() {
    let css = `#identifier, .a { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="a"></div><div id="ident*"></div>
    `);
    let expectedCss = css;
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Removes selectors if they don't match at the beginning"() {
    let css = `#not-identifier.a { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="a"></div><div id="ident*"></div>
    `);
    let expectedCss = "";
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Keeps selectors if they might match at the end"() {
    let css = `.my-class { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="a *-class"></div>
    `);
    let expectedCss = css;
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Removes selectors if they don't match at the end"() {
    let css = `.my-food { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="a *-foo"></div>
    `);
    let expectedCss = "";
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Keeps selectors if they might match at both ends"() {
    let css = `.my-class-project { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="a my-*-project"></div>
    `);
    let expectedCss = css;
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Removes selectors if they don't match at both ends"() {
    let css = `.my_class_project { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="a my-*-project"></div>
    `);
    let expectedCss = "";
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Basic attribute support"() {
    let css = `.a[lang] { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="a" lang="en-us"></div>
    `);
    let expectedCss = css;
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Basic attribute removal support"() {
    let css = `.a:not([lang]) { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="a" lang="en-us"></div>
    `);
    let expectedCss = "";
    return testRemoveUnusedStyles([css, template], expectedCss);
  }
  @test "Can read actions performed after optimization"() {
    let css = `#missing { width: 100%; }
               #missing, .b { display: none; }`;
    let template = new TestTemplate("test", clean`
      <div class="b c"></div>
    `);
    let expectedCss = `.b { display: none; }`;
    return testRemoveUnusedStyles([css, template], expectedCss).then(result => {
      let ruleRemoved = <RemoveRule>result.actions.performed[0];
      let selectorChanged = <ChangeSelector>result.actions.performed[1];
      assert.equal(ruleRemoved.rule.selector, "#missing");
      assert.equal(ruleRemoved.optimization, "removeUnusedStyles");
      assert.equal(selectorChanged.oldSelector, "#missing, .b");
      assert.equal(selectorChanged.newSelector, ".b");
      assert.equal(selectorChanged.optimization, "removeUnusedStyles");
      assert.equal(ruleRemoved.logString(), `${path.resolve("test1.css")}:1:1 [removeUnusedStyles] Removed rule with selector "#missing" because no element found that matches #missing.`);
      assert.equal(selectorChanged.logString(), `${path.resolve("test1.css")}:2:16 [removeUnusedStyles] Changed selector from "#missing, .b" to ".b" because no element found that matches #missing.`);
    });
  }
}
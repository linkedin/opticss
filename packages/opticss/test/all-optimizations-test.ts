import { suite, test, skip, only } from "mocha-typescript";
import { assert } from "chai";
import * as path from 'path';
import * as postcss from 'postcss';

import { OptimizationResult } from "../src/Optimizer";
import { TestTemplate } from "./util/TestTemplate";
import clean from "./util/clean";
import {
  CascadeTestResult,
  debugError,
  debugResult,
  testOptimizationCascade,
} from './util/assertCascade';
import { TemplateIntegrationOptions, RewritableIdents } from "../src/OpticssOptions";
import { IdentGenerator, IdentGenerators } from "../src/util/IdentGenerator";
import { assertSmaller, debugSize, assertSmallerStylesAndMarkup } from "./util/assertSmaller";

function testAll(...stylesAndTemplates: Array<string | TestTemplate>): Promise<CascadeTestResult> {
  return testOptimizationCascade(
    { },
    { rewriteIdents: { id: true, class: true } },
    ...stylesAndTemplates);
}

@suite("Running All Optimizations")
export class MergeDeclarationsTest {
  @test "on two sibling elements"() {
    let css1 = clean`
    #first { float: left;}
    #second { float: right;}
    .asdf { color: red; }
    .wsx { border: 1px solid blue; }
    .qwerty { background: red; }
    .qaz { border-color: blue; color: red; }
    #third { clear: both; position: relative; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="(qwerty | asdf)" id="(first | second)"></div>
    <div class="(--- | wsx | qaz)" id="third"></div>
  `);
    return testAll(css1, template).then(result => {
      assert.deepEqual(result.optimization.output.content.toString(), clean`
        #a { float: left;}
        #b { float: right;}
        .b { color: red; }
        .c { border: 1px solid blue; }
        .d { background: red; }
        .e { border-color: blue; }
        #c { clear: both; position: relative; }
      `);
      // debugResult(css1, result);
      return assertSmaller(css1, result);
    }).catch(error => {
      debugError(css1, error);
      throw error;
    });
  }

  @skip
  @test "mergeable decls with ids"() {
    let css1 = clean`
    #first { color: red; }
    .asdf { border: 1px solid blue; }
    .wsx { border-width: 1px; }
    .qwerty { border-color: blue; color: red; }
    .qaz { border-style: solid; }
  `;
    let template = new TestTemplate("test", clean`
    <div class="(qwerty | asdf)" id="first"></div>
    <div class="(--- | wsx | qaz)"></div>
  `);
    return testAll(css1, template).then(result => {
      assert.deepEqual(result.optimization.output.content.toString(), clean`
      `);
      // debugResult(css1, result);
      return assertSmaller(css1, result);
    }).catch(error => {
      debugError(css1, error);
      throw error;
    });
  }
}

function parseStylesheet(content: string): Promise<postcss.Result> {
  return new Promise<postcss.Result>((resolve, reject) => {
    postcss().process(content, {from: "stylesheet.css"}).then(resolve, reject);
  });
}
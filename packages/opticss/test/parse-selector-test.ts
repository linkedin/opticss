import {
  assert,
} from 'chai';
import {
  skip,
  suite,
  test,
} from 'mocha-typescript';
import selectorParser = require('postcss-selector-parser');

import { parseSelector } from '../src/parseSelector';

// import assertError from "./util/assertError";

@suite("parseSelector")
export class ParseSelectorTests {

  @test "handles string input"() {
    let selector = ".foo .bar, .biz .baz";
    let res = parseSelector(selector);
    assert.equal(res.length, 2);
    assert.equal(res[0].length, 2);
  }

  @test "handles pseudo elements"() {
    let selector = "::selection";
    let res = parseSelector(selector);
    assert.equal(res.length, 1);
    assert.equal(res[0].length, 1);
    assert.isDefined(res[0].selector);
  }

  @test "handles selectorParser.Root"() {
    let selector = selectorParser().astSync(".foo .bar, .biz .baz");
    let res = parseSelector(selector);

    assert.equal(res.length, 2);
    assert.equal(res[0].length, 2);
  }

  // Theres something weird going on here
  @test @skip "handles selectorParser.Node[]"() {
    let selector = selectorParser().astSync(".foo .bar, .biz .baz").nodes;
    console.log(selector);
    let res = parseSelector(selector);
    console.log(res);
    assert.equal(res.length, 2);
    assert.equal(res[0].length, 2);
  }

  // Theres something weird going on here
  @test @skip "handles selectorParser.Node[][]"() {
    let selector = [ selectorParser().astSync(".foo .bar").nodes, selectorParser().astSync(".biz .baz").nodes ];
    console.log(selector);
    let res = parseSelector(selector);
    console.log(res[0].selector.nodes);
    assert.equal(res.length, 2);
    assert.equal(res[0].length, 2);
  }

}

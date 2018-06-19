import {
  assert,
} from "chai";
import {
  skip,
  suite,
  test,
} from "mocha-typescript";
import selectorParser = require("postcss-selector-parser");

import { parseSelector } from "../src/parseSelector";

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

  @test "normalizes pseudo elements"() {
    let selector = ".foo:before";
    let res = parseSelector(selector);
    assert.equal(res.length, 1);
    assert.equal(res[0].length, 1);
    assert.isDefined(res[0].selector);
    assert.equal(res.toString(), ".foo::before");

    selector = ".foo:after";
    res = parseSelector(selector);
    assert.equal(res.length, 1);
    assert.equal(res[0].length, 1);
    assert.isDefined(res[0].selector);
    assert.equal(res.toString(), ".foo::after");
  }

  @test "injects universal selector on bare pseudos"() {
    let selector = ":before";
    let res = parseSelector(selector);
    assert.equal(res.length, 1);
    assert.equal(res[0].length, 1);
    assert.isDefined(res[0].selector);
    assert.equal(res.toString(), "*::before");
  }

  @test "handles selectorParser.Root"() {
    let selector = selectorParser().astSync(".foo .bar, .biz .baz");
    let res = parseSelector(selector);

    assert.equal(res.length, 2);
    assert.equal(res[0].length, 2);
  }

  @test "can merge two compound selectors – classes only"() {
    let one = parseSelector(".foo");
    let two = parseSelector(".bar");
    one[0].key.mergeNodes(two[0].key);
    assert.equal(one.toString(), ".foo.bar");
  }

  @test "can merge two compound selectors – classes and elements selectors"() {
    let one = parseSelector(".foo");
    let two = parseSelector("[bar=baz]");
    one[0].key.mergeNodes(two[0].key);
    assert.equal(one.toString(), ".foo[bar=baz]");
  }

  @test "can merge two compound selectors with agreeing pseudo elements"() {
    let one = parseSelector(".foo:before");
    let two = parseSelector(".bar::before");
    one[0].key.mergeNodes(two[0].key);
    assert.equal(one.toString(), ".foo.bar::before");
  }

  @test "can merge two compound selectors with valid-to-mix pseudos"() {
    let one = parseSelector(".foo:last-of-type");
    let two = parseSelector(".foo:nth-of-type(1)::before");
    one[0].key.mergeNodes(two[0].key);
    assert.equal(one.toString(), ".foo:last-of-type:nth-of-type(1)::before");
  }

  @test "throws when merging two compound selectors with disagreeing pseudo elements"() {
    let one = parseSelector(".foo:before");
    let two = parseSelector(".bar:after");
    assert.throws(
      () => {
        one[0].key.mergeNodes(two[0].key);
      },
      "Cannot merge two compound selectors with different pseudoelements",
    );
  }

  @test "can remove the last compound selector"() {
    let one = parseSelector(".foo.bar .biz.baz .fiz.bang");
    one[0].selector.removeLast();
    assert.equal(one.toString(), ".foo.bar .biz.baz");
    one[0].selector.removeLast();
    assert.equal(one.toString(), ".foo.bar");

    // Can not remove the final selector, there'd be no linked list!
    one[0].selector.removeLast();
    assert.equal(one.toString(), ".foo.bar");
  }

  @test "isContext returns correct compound selector status"() {
    let sel = parseSelector(".foo.bar .biz.baz .fiz.bang")[0];
    assert.equal(sel.isContext(sel.key), false);
    assert.equal(sel.isContext(sel.selector), true);
    assert.equal(sel.isContext(sel.selector.next!.selector), true);
    sel.selector.removeLast();
    assert.equal(sel.isContext(sel.selector), true);
    assert.equal(sel.isContext(sel.selector.next!.selector), false);
    sel.selector.removeLast();
    assert.equal(sel.isContext(sel.selector), false);
  }

  @test "toContextString works for selectors with context"() {
    let sel = parseSelector(".foo.bar .biz.baz > .fiz.bang")[0];
    assert.equal(sel.toContextString(), ".foo.bar .biz.baz > ");
  }

  @test "toContextString works for selectors without context"() {
    let sel = parseSelector(".foo.bar")[0];
    assert.equal(sel.toContextString(), "");
  }

  @test "append works"() {
    let sel = parseSelector(".foo.bar")[0];
    let combinator = selectorParser.combinator({
      value: ">",
      spaces: {
        before: " ",
        after: " ",
      },
    });
    let newSel = parseSelector(".biz.baz")[0].selector;
    sel.selector.append(combinator, newSel);
    assert.equal(sel.toString(), ".foo.bar > .biz.baz");
  }

  @test "insertBefore works"() {
    let sel = parseSelector(".foo.bar .fizz.buzz")[0];
    let combinator = selectorParser.combinator({value: " > "});
    let newSel = parseSelector(".biz.baz")[0].selector;
    sel.selector.insertBefore(newSel, combinator, sel.key);
    assert.equal(sel.toString(), ".foo.bar .biz.baz > .fizz.buzz");
  }

  @test "insertBefore fails quietly if target selector is not found"() {
    let sel = parseSelector(".foo.bar .fizz.buzz")[0];
    let combinator = selectorParser.combinator({value: " > "});
    let newSel = parseSelector(".biz.baz")[0].selector;
    sel.selector.insertBefore(newSel, combinator, newSel);
    assert.equal(sel.toString(), ".foo.bar .fizz.buzz");
  }

  // Theres something weird going on here
  @test @skip "handles selectorParser.Node[]"() {
    let selector = selectorParser().astSync(".foo .bar, .biz .baz").nodes;
    let res = parseSelector(selector);
    assert.equal(res.length, 2);
    assert.equal(res[0].length, 2);
  }

  // Theres something weird going on here
  @test @skip "handles selectorParser.Node[][]"() {
    let selector = [ selectorParser().astSync(".foo .bar").nodes, selectorParser().astSync(".biz .baz").nodes ];
    let res = parseSelector(selector);
    assert.equal(res.length, 2);
    assert.equal(res[0].length, 2);
  }

}

import { suite, test, skip, only } from "mocha-typescript";
import { assert } from "chai";

import { OptiCSS } from "../src/opticss";
import {
  Tagname, TagnameNS, Attribute
} from "../src/Styleable";
import {
  default as parseSelector,
  CompoundSelector,
} from "../src/parseSelector";

function selector(selector: string): CompoundSelector {
  let parsed = parseSelector(selector);
  return parsed[0].selector;
}

@suite("Styleable Tagname")
export class StyleableTagnameTest {
  @test "can be unknown"() {
    let tagname = new Tagname({unknown: true});
    assert.equal(tagname.value.unknown, true);
    assert.equal(tagname.toString(), "???");
  }
  @test "can be a constant"() {
    let tagname = new Tagname({value: "span"});
    assert.equal(tagname.value.value, "span");
    assert.equal(tagname.toString(), "span");
  }
  @test "can be a choice"() {
    let tagname = new Tagname({oneOf: ["div", "span"]});
    assert.deepEqual(tagname.value.oneOf, ["div", "span"]);
    assert.equal(tagname.toString(), "div|span");
  }
  @test "can have a namespace"() {
    let tagname = new TagnameNS("https://www.w3.org/2000/svg", {value: "svg"});
    assert.deepEqual(tagname.value.value, "svg");
    assert.equal(tagname.namespaceURL, "https://www.w3.org/2000/svg");
    assert.equal(tagname.toString(), "https://www.w3.org/2000/svg:svg");
  }
  @test "when unknown matches any selector"() {
    let tagname = new Tagname({unknown: true});
    assert.isFalse(tagname.willNotMatch(selector("span")));
  }
  @test "a constant value won't match a different specific selector"() {
    let tagname = new Tagname({value: "span"});
    assert.isTrue(tagname.willNotMatch(selector("div")));
  }
  @test "a constant value matches the same specific selector"() {
    let tagname = new Tagname({value: "span"});
    assert.isFalse(tagname.willNotMatch(selector("span")));
  }
  @test "a choice won't match if the value isn't one of the values"() {
    let tagname = new Tagname({oneOf: ["div", "span"]});
    assert.isTrue(tagname.willNotMatch(selector("input")));
  }
  @test "a choice matches if the value is one of the values"() {
    let tagname = new Tagname({oneOf: ["div", "span"]});
    assert.isFalse(tagname.willNotMatch(selector("div")));
    assert.isFalse(tagname.willNotMatch(selector("span")));
  }
  @test "might match a class selector"() {
    let tagname = new Tagname({value: "div"});
    assert.isFalse(tagname.willNotMatch(selector(".foo")));
  }
  @test "might match a compound selector containing the tag"() {
    let tagname = new Tagname({value: "div"});
    assert.isFalse(tagname.willNotMatch(selector("div.foo")));
  }
  @test "won't match a compound selector not containing the tag"() {
    let tagname = new Tagname({value: "div"});
    assert.isTrue(tagname.willNotMatch(selector("span.foo")));
  }
}

@suite("Styleable Attribute")
export class StyleableAttributeTest {
  @test "can be unknown"() {
    let attr = new Attribute("class", {unknown: true});
    assert.equal(attr.value.unknown, true);
    assert.equal(attr.toString(), 'class="???"');
  }
  @test "can be absent"() {
    let attr = new Attribute("class", {absent: true});
    assert.equal(attr.value.absent, true);
    assert.equal(attr.toString(), "class");
  }
  @test "can have a constant value"() {
    let attr = new Attribute("class", {value: "asdf"});
    assert.equal(attr.value.value, "asdf");
    assert.equal(attr.toString(), 'class="asdf"');
  }
  @test "can have a choice of constant values"() {
    let attr = new Attribute("class", {
      oneOf: [
        {value: "asdf"},
        {value: "foo"}
      ]
    });
    assert.deepEqual(attr.value.oneOf,
                     [{value: "asdf"},
                      {value: "foo"}]);
    assert.equal(attr.toString(), 'class="(asdf|foo)"');
  }
  @test "can have a startsWith value"() {
    let attr = new Attribute("class", {startsWith: "asdf"});
    assert.equal(attr.value.startsWith, "asdf");
    assert.equal(attr.toString(), 'class="asdf*"');
  }
  @test "can have an endsWith value"() {
    let attr = new Attribute("class", {endsWith: "asdf"});
    assert.equal(attr.value.endsWith, "asdf");
    assert.equal(attr.toString(), 'class="*asdf"');
  }
  @test "can have startsWith and endsWith values"() {
    let attr = new Attribute("class", {startsWith: "qwer", endsWith: "asdf"});
    assert.equal(attr.value.startsWith, "qwer");
    assert.equal(attr.value.endsWith, "asdf");
    assert.equal(attr.toString(), 'class="qwer*asdf"');
  }
  @test "can have a choice of different values"() {
    let attr = new Attribute("class", {
      oneOf: [
        {absent: true},
        {value: "asdf"},
        {startsWith: "foo"},
        {endsWith: "bar"},
        {startsWith: "aaaa", endsWith: "zzzz"},
      ]
    });
    assert.deepEqual(attr.value.oneOf,
                     [{absent: true},
                      {value: "asdf"},
                      {startsWith: "foo"},
                      {endsWith: "bar"},
                      {startsWith: "aaaa", endsWith: "zzzz"},
                    ]);
    assert.equal(attr.toString(), 'class="(<absent>|asdf|foo*|*bar|aaaa*zzzz)"');
  }
}
import {
  Attribute,
  AttributeValueChoiceOption,
  Tagname,
  TagnameNS,
  isAbsent,
  isChoice,
  isConstant,
  isEndsWith,
  isSet,
  isStartsAndEndsWith,
  isStartsWith,
  isTagChoice,
  isUnknown,
} from "@opticss/element-analysis";
import { assert } from "chai";
import { suite, test } from "mocha-typescript";

import { Match, TagMatcher } from "../src/Match";
import { CompoundSelector, parseSelector } from "../src/parseSelector";

const tagMatcher = TagMatcher.instance;

function selector(selector: string): CompoundSelector {
  let parsed = parseSelector(selector);
  return parsed[0].selector;
}

@suite("Selectable Tagname")
export class SelectableTagnameTest {
  @test "can be unknown"() {
    let tagname = new Tagname({unknown: true});
    assert.isTrue(isUnknown(tagname.value));
    assert.equal(tagname.toString(), "???");
  }
  @test "can be a constant"() {
    let tagname = new Tagname({constant: "span"});
    assert.isTrue(isConstant(tagname.value));
    assert.equal(tagname.toString(), "span");
  }
  @test "can be a choice"() {
    let tagname = new Tagname({oneOf: ["div", "span"]});
    assert.isTrue(isTagChoice(tagname.value));
    assert.equal(tagname.toString(), "div|span");
  }
  @test "can have a namespace"() {
    let tagname = new TagnameNS("https://www.w3.org/2000/svg", {constant: "svg"});
    assert.deepEqual(isConstant(tagname.value) && tagname.value.constant, "svg");
    assert.equal(tagname.namespaceURL, "https://www.w3.org/2000/svg");
    assert.equal(tagname.toString(), "https://www.w3.org/2000/svg:svg");
  }
  @test "when unknown matches any selector"() {
    let tagname = new Tagname({unknown: true});
    assert.equal(tagMatcher.matchSelectorComponent(tagname, selector("span")), Match.maybe);
  }
  @test "a constant value won't match a different specific selector"() {
    let tagname = new Tagname({constant: "span"});
    assert.equal(tagMatcher.matchSelectorComponent(tagname, selector("div")), Match.no);
  }
  @test "a constant value matches the same specific selector"() {
    let tagname = new Tagname({constant: "span"});
    assert.equal(tagMatcher.matchSelectorComponent(tagname, selector("span")), Match.yes);
  }
  @test "a choice won't match if the value isn't one of the values"() {
    let tagname = new Tagname({oneOf: ["div", "span"]});
    assert.equal(tagMatcher.matchSelectorComponent(tagname, selector("input")), Match.no);
  }
  @test "a choice matches if the value is one of the values"() {
    let tagname = new Tagname({oneOf: ["div", "span"]});
    assert.equal(tagMatcher.matchSelectorComponent(tagname, selector("div")), Match.yes);
    assert.equal(tagMatcher.matchSelectorComponent(tagname, selector("span")), Match.yes);
  }
  @test "passes matching a class selector"() {
    let tagname = new Tagname({constant: "div"});
    assert.equal(tagMatcher.matchSelectorComponent(tagname, selector(".foo")), Match.pass);
  }
  @test "might match a compound selector containing the tag"() {
    let tagname = new Tagname({constant: "div"});
    assert.equal(tagMatcher.matchSelectorComponent(tagname, selector("div.foo")), Match.yes);
  }
  @test "won't match a compound selector not containing the tag"() {
    let tagname = new Tagname({constant: "div"});
    assert.equal(tagMatcher.matchSelectorComponent(tagname, selector("span.foo")), Match.no);
  }
}

@suite("Selectable Attribute")
export class SelectableAttributeTest {
  @test "can be unknown"() {
    let attr = new Attribute("class", {unknown: true});
    assert.isTrue(isUnknown(attr.value));
    assert.equal(attr.toString(), 'class="???"');
    assert.equal(attr.isLegal("asdf"), true);
    assert.equal(attr.isLegal("asdf qwert"), true);
  }
  @test "can be absent"() {
    let attr = new Attribute("class", {absent: true});
    assert.isTrue(isAbsent(attr.value));
    assert.equal(attr.toString(), "class");
    assert.equal(attr.isLegal(""), true);
    assert.equal(attr.isLegal("asdf"), false);
  }
  @test "can have a constant value"() {
    let attr = new Attribute("class", {constant: "asdf"});
    assert.equal(isConstant(attr.value) && attr.value.constant, "asdf");
    assert.equal(attr.toString(), 'class="asdf"');
    assert.equal(attr.isLegal("asdf"), true);
    assert.equal(attr.isLegal("asdd"), false);
  }
  @test "can have a choice of constant values"() {
    let attr = new Attribute("class", {
      oneOf: [
        {constant: "asdf"},
        {constant: "foo"},
      ],
    });
    assert.deepEqual(
      isChoice(attr.value) && attr.value.oneOf,
      [
        {constant: "asdf"},
        {constant: "foo"},
      ]);
    assert.equal(attr.toString(), 'class="(asdf|foo)"');
    assert.equal(attr.isLegal("asdf"), true);
    assert.equal(attr.isLegal("foo"), true);
    assert.equal(attr.isLegal("bar"), false);
  }
  @test "can have a startsWith value"() {
    let attr = new Attribute("class", {startsWith: "asdf", whitespace: false});
    assert.equal(isStartsWith(attr.value) && attr.value.startsWith, "asdf");
    assert.equal(attr.toString(), 'class="asdf*"');
    assert.equal(attr.isLegal("asdffa"), true);
    assert.equal(attr.isLegal("asdffa qwer"), false);
  }
  @test "can have an endsWith value"() {
    let attr = new Attribute("class", {endsWith: "asdf", whitespace: false});
    assert.equal(isEndsWith(attr.value) && attr.value.endsWith, "asdf");
    assert.equal(attr.toString(), 'class="*asdf"');
    assert.equal(attr.isLegal("poiuasdf"), true);
    assert.equal(attr.isLegal("po iuasdf"), false);
  }
  @test "can have startsWith and endsWith values"() {
    let attr = new Attribute("class", {startsWith: "qwer", endsWith: "asdf", whitespace: false});
    assert.equal(isStartsAndEndsWith(attr.value) && attr.value.startsWith, "qwer");
    assert.equal(isStartsAndEndsWith(attr.value) && attr.value.endsWith, "asdf");
    assert.equal(attr.toString(), 'class="qwer*asdf"');
  }
  @test "can have a choice of different values"() {
    let attr = new Attribute("class", {
      oneOf: [
        {absent: true},
        {constant: "asdf"},
        {startsWith: "foo", whitespace: false},
        {endsWith: "bar", whitespace: false},
        {startsWith: "aaaa", endsWith: "zzzz", whitespace: false},
      ],
    });
    assert.deepEqual<AttributeValueChoiceOption[]>(
      isChoice(attr.value) && attr.value.oneOf || [],
      [
        {absent: true},
        {constant: "asdf"},
        {startsWith: "foo", whitespace: false},
        {endsWith: "bar", whitespace: false},
        {startsWith: "aaaa", endsWith: "zzzz", whitespace: false},
      ]);
    assert.equal(attr.toString(), 'class="(---|asdf|foo*|*bar|aaaa*zzzz)"');
  }
  @test "can have a list of values"() {
    let attr = new Attribute("class", {
      allOf: [
        {constant: "asdf"},
        {startsWith: "foo", whitespace: false},
        {endsWith: "bar", whitespace: false},
        {startsWith: "aaaa", endsWith: "zzzz", whitespace: false},
      ],
    });
    assert.deepEqual(
      isSet(attr.value) && attr.value.allOf,
      [
        {constant: "asdf"},
        {startsWith: "foo", whitespace: false},
        {endsWith: "bar", whitespace: false},
        {startsWith: "aaaa", endsWith: "zzzz", whitespace: false},
      ]);
    assert.equal(attr.toString(), 'class="asdf foo* *bar aaaa*zzzz"');
  }
  @test "can have nested lists and optionals"() {
    let attr = new Attribute("class", {
      allOf: [
        {oneOf: [
          {allOf: [{constant: "a"}, {constant: "b"}]},
          {allOf: [{constant: "c"}, {constant: "d"}]},
        ]},
        {oneOf: [
          {allOf: [{constant: "e"}, {constant: "f"}]},
          {allOf: [{constant: "g"}, {constant: "h"}]},
        ]},
      ],
    });
    assert.equal(attr.toString(), 'class="(a b|c d) (e f|g h)"');
  }
  @test "can flatten a set of choices of sets"() {
    let attr = new Attribute("class", {
      allOf: [
        {oneOf: [
          {allOf: [{constant: "a"}, {constant: "b"}]},
          {allOf: [{constant: "c"}, {constant: "d"}]},
        ]},
        {oneOf: [
          {allOf: [{constant: "e"}, {constant: "f"}]},
          {allOf: [{constant: "g"}, {constant: "h"}]},
        ]},
      ],
    });
    let flattened = attr.flattenedValue();
    assert.deepEqual(
      flattened,
      [
        {allOf: [{constant: "a"}, {constant: "b"}, {constant: "e"}, {constant: "f"}]},
        {allOf: [{constant: "c"}, {constant: "d"}, {constant: "e"}, {constant: "f"}]},
        {allOf: [{constant: "a"}, {constant: "b"}, {constant: "g"}, {constant: "h"}]},
        {allOf: [{constant: "c"}, {constant: "d"}, {constant: "g"}, {constant: "h"}]},
      ]);
  }
  @test "can flatten choice of sets"() {
    let attr = new Attribute("class", {
      oneOf: [
        {allOf: [{constant: "e"}, {constant: "f"}]},
        {allOf: [{constant: "g"}, {constant: "h"}]},
      ],
    });
    let flattened = attr.flattenedValue();
    assert.deepEqual(
      flattened,
      [
        {allOf: [{constant: "e"}, {constant: "f"}]},
        {allOf: [{constant: "g"}, {constant: "h"}]},
      ]);
  }
  @test "can flatten set of choices"() {
    let attr = new Attribute("class", {
      allOf: [
        {oneOf: [{constant: "e"}, {constant: "f"}]},
        {oneOf: [{constant: "g"}, {constant: "h"}]},
      ],
    });
    let flattened = attr.flattenedValue();
    assert.deepEqual(
      flattened,
      [
        {allOf: [{constant: "e"}, {constant: "g"}]},
        {allOf: [{constant: "f"}, {constant: "g"}]},
        {allOf: [{constant: "e"}, {constant: "h"}]},
        {allOf: [{constant: "f"}, {constant: "h"}]},
      ]);
  }
}

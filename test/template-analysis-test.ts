import { suite, test, skip, only } from "mocha-typescript";
import { assert } from "chai";

import { OptiCSS } from "../src/opticss";
import {
  Tagname, TagnameNS, Attribute, Class
} from "../src/Styleable";
import {
  default as parseSelector,
  CompoundSelector,
} from "../src/parseSelector";
import { TemplateAnalysis } from "../src/TemplateAnalysis";
import { Template } from "../src/TemplateInfo";
import { SimpleAnalyzer } from "./util/SimpleAnalyzer";

function selector(selector: string): CompoundSelector {
  let parsed = parseSelector(selector);
  return parsed[0].selector;
}

function clean(strings: TemplateStringsArray, ...expressions: string[]) {
  let str = strings.reduce((prev, s, i) =>
    prev + s + ((expressions.length > i) ? expressions[i].toString() : ''));
  return str.split("\n").map(s => s.trim()).join("\n").trim();
}

@suite("Template Analysis")
export class TemplateAnalysisTest {
  @test "Can add an element"() {
    let template = new Template("test");
    let analyzer = new SimpleAnalyzer(template, clean`
      <div class="foo"></div>
    `);
    assert.deepEqual(analyzer.analyze().serialize().elements,
      [
        {
          "tagname": { "value": { "constant": "div" } },
          "attributes": [
            { "name": "class", "value": { "constant": "foo" } }
          ]
        }
      ]);
  }
  @test "Can add an attribute with no value"() {
    let template = new Template("test");
    let analyzer = new SimpleAnalyzer(template, clean`
      <div contenteditable></div>
    `);
    assert.deepEqual(analyzer.analyze().serialize().elements,
      [
        {
          "tagname": { "value": { "constant": "div" } },
          "attributes": [
            { "name": "contenteditable", "value": { "absent": true } }
          ]
        }
      ]);
  }
  @test "Can add an attribute with unknown value"() {
    let template = new Template("test");
    let analyzer = new SimpleAnalyzer(template, clean`
      <div data-foo="???"></div>
    `);
    assert.deepEqual(analyzer.analyze().serialize().elements,
      [
        {
          "tagname": { "value": { "constant": "div" } },
          "attributes": [
            { "name": "data-foo", "value": { "unknown": true } }
          ]
        }
      ]);
  }
  @test "Can add an attribute with unknown identifier"() {
    let template = new Template("test");
    let analyzer = new SimpleAnalyzer(template, clean`
      <div class="?"></div>
    `);
    assert.deepEqual(analyzer.analyze().serialize().elements,
      [
        {
          "tagname": { "value": { "constant": "div" } },
          "attributes": [
            { "name": "class", "value": { "unknownIdentifier": true } }
          ]
        }
      ]);
  }
  @test "Can add an attribute with two unknown identifiers"() {
    let template = new Template("test");
    let analyzer = new SimpleAnalyzer(template, clean`
      <div class="? ?"></div>
    `);
    assert.deepEqual(analyzer.analyze().serialize().elements,
      [
        {
          "tagname": { "value": { "constant": "div" } },
          "attributes": [
            { "name": "class",
              "value": {
                "allOf": [
                  { "unknownIdentifier": true },
                  { "unknownIdentifier": true }
                ]
              }
            }
          ]
        }
      ]
    );
  }
  @test "Analyzes a non-trivial fragment."() {
    let template = new Template("test");
    let analyzer = new SimpleAnalyzer(template, clean`
      <article class="main-content">
        <h1>My Title</h1>
        <img src="http://foo.com/wtf" style="background-color: red;" />
        <p>Four score and twenty years ago our forefathers brought forth a new nation...</p>
      </article>
    `);
    let els = analyzer.analyze().serialize().elements;
    assert.deepEqual(els, [
      {
        "tagname": { "value": { "constant": "article" } },
        "attributes": [
          { "name": "class", "value": { "constant": "main-content" } }
        ]
      },
      {
        "tagname": { "value": { "constant": "h1" } },
        "attributes": []
      },
      {
        "tagname": { "value": { "constant": "img" } },
        "attributes": [
          { "name": "src", "value": { "constant": "http://foo.com/wtf" } },
          { "name": "style", "value": { "constant": "background-color: red;" } }
        ]
      },
      {
        "tagname": { "value": { "constant": "p" } },
        "attributes": [],
      }
    ]);
  }
  @test "Can analyze a complex nested dynamic class expression"() {
    let template = new Template("test");
    let analyzer = new SimpleAnalyzer(template, clean`
      <div class="a (b | c1 c2 c3 | d) e f* *g h*i (--- | j) ?"></div>
    `);
    assert.deepEqual(analyzer.analyze().serialize().elements,
      [
        {
          "tagname": { "value": { "constant": "div" } },
          "attributes": [
            { "name": "class", "value": {
                "allOf": [ { "constant": "a" },
                           { "oneOf": [ { "constant": "b" },
                                        { "allOf": [ { "constant": "c1" },
                                                     { "constant": "c2" },
                                                     { "constant": "c3" } ] },
                                        { "constant": "d" } ] },
                           { "constant": "e" },
                           { "startsWith": "f" },
                           { "endsWith": "g" },
                           { "startsWith": "h",
                             "endsWith": "i" },
                           { "oneOf": [ { "absent": true },
                                       { "constant": "j" } ] },
                           { "unknownIdentifier": true } ] } } ] }
      ]);
  }
}
import { suite, test, skip, only } from "mocha-typescript";
import { assert } from "chai";

import {
  Tagname, TagnameNS, Attribute, Class
} from "../src/Selectable";
import {
  default as parseSelector,
  CompoundSelector,
} from "../src/parseSelector";
import { TemplateAnalysis } from "../src/TemplateAnalysis";
import { Template } from "../src/TemplateInfo";
import { SimpleAnalyzer } from "./util/SimpleAnalyzer";
import { TestTemplate } from "./util/TestTemplate";
import clean from "./util/clean";

function selector(selector: string): CompoundSelector {
  let parsed = parseSelector(selector);
  return parsed[0].selector;
}

@suite("Template Analysis")
export class TemplateAnalysisTest {
  @test "Can add an element"() {
    let template = new TestTemplate("test", clean`
      <div class="foo"></div>
    `);
    let analyzer = new SimpleAnalyzer(template);
    return analyzer.analyze().then(analysis => {
      assert.deepEqual(
        analysis.serialize().elements,
        [
          {
            "tagname": { "value": { "constant": "div" } },
            "attributes": [
              { "name": "class", "value": { "constant": "foo" } }
            ]
          }
        ]
      );
    });
  }
  @test "Can add an attribute with no value"() {
    let template = new TestTemplate("test", clean`
      <div contenteditable></div>
    `);
    let analyzer = new SimpleAnalyzer(template);
    return analyzer.analyze().then(analysis => {
      assert.deepEqual(analysis.serialize().elements,
        [
          {
            "tagname": { "value": { "constant": "div" } },
            "attributes": [
              { "name": "contenteditable", "value": { "absent": true } }
            ]
          }
        ]);
    });
  }
  @test "Can add an attribute with unknown value"() {
    let template = new TestTemplate("test", clean`
    <div data-foo="???"></div>
  `);
    let analyzer = new SimpleAnalyzer(template);
    return analyzer.analyze().then(analysis => {
      assert.deepEqual(analysis.serialize().elements,
        [
          {
            "tagname": { "value": { "constant": "div" } },
            "attributes": [
              { "name": "data-foo", "value": { "unknown": true } }
            ]
          }
        ]);
    });
  }
  @test "Can add an attribute with unknown identifier"() {
    let template = new TestTemplate("test", clean`
      <div class="?"></div>
    `);
    let analyzer = new SimpleAnalyzer(template);
    return analyzer.analyze().then(analysis => {
      assert.deepEqual(analysis.serialize().elements,
        [
          {
            "tagname": { "value": { "constant": "div" } },
            "attributes": [
              { "name": "class", "value": { "unknownIdentifier": true } }
            ]
          }
        ]);
    });
  }
  @test "Can add an attribute with two unknown identifiers"() {
    let template = new TestTemplate("test", clean`
      <div class="? ?"></div>
    `);
    let analyzer = new SimpleAnalyzer(template);
    return analyzer.analyze().then(analysis => {
      assert.deepEqual(analysis.serialize().elements,
        [
          {
            "tagname": { "value": { "constant": "div" } },
            "attributes": [
              {
                "name": "class",
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
    });
  }
  @test "Analyzes a non-trivial fragment."() {
    let template = new TestTemplate("test", clean`
    <article class="main-content">
      <h1>My Title</h1>
      <img src="http://foo.com/wtf" style="background-color: red;" />
      <p>Four score and twenty years ago our forefathers brought forth a new nation...</p>
    </article>
  `);
    let analyzer = new SimpleAnalyzer(template);
    return analyzer.analyze().then(analysis => {
      let els = analysis.serialize().elements;
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
    });
  }
  @test "Can analyze a complex nested dynamic class expression"() {
    let template = new TestTemplate("test", clean`
    <div class="a (b | c1 c2 c3 | d) e f* *g h*i (--- | j) ?"></div>
  `);
    let analyzer = new SimpleAnalyzer(template);
    return analyzer.analyze().then(analysis => {
      assert.deepEqual(analysis.serialize().elements,
        [
          {
            "tagname": { "value": { "constant": "div" } },
            "attributes": [
              {
                "name": "class", "value": {
                  "allOf": [{ "constant": "a" },
                  {
                    "oneOf": [{ "constant": "b" },
                    {
                      "allOf": [{ "constant": "c1" },
                      { "constant": "c2" },
                      { "constant": "c3" }]
                    },
                    { "constant": "d" }]
                  },
                  { "constant": "e" },
                  { "startsWith": "f" },
                  { "endsWith": "g" },
                  {
                    "startsWith": "h",
                    "endsWith": "i"
                  },
                  {
                    "oneOf": [{ "absent": true },
                    { "constant": "j" }]
                  },
                  { "unknownIdentifier": true }]
                }
              }]
          }
        ]);
    });
  }
}
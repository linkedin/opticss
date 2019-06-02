import {
  Attribute,
  Element,
  Tagname,
} from "@opticss/element-analysis";
import { TestTemplate } from "@opticss/simple-template";
import {
  RewritableIdents,
} from "@opticss/template-api";
import { clean } from "@opticss/util";
import {
  assert,
} from "chai";
import {
  suite,
  test,
} from "mocha-typescript";
import * as path from "path";
import { documentToString } from "resolve-cascade";

import {
  IdentGenerator,
  IdentGenerators,
} from "../../src/util/IdentGenerator";
import {
  CascadeTestResult,
  testOptimizationCascade,
} from "../util/assertCascade";

function testRewriteIdents(templateRewriteOpts: RewritableIdents, ...stylesAndTemplates: Array<string | TestTemplate>): Promise<CascadeTestResult> {
  return testOptimizationCascade(
    { only: ["rewriteIdents"] },
    {
      rewriteIdents: templateRewriteOpts,
      analyzedAttributes: [],
      analyzedTagnames: true,
    },
    ...stylesAndTemplates);
}

@suite("Rewrite idents")
export class RewriteIdentsTest {
  @test "has an ident generator"() {
    const idGen = new IdentGenerator();
    assert.equal(idGen.nextIdent(), "a");
    assert.equal(idGen.nextIdent(), "b");
    for (let i = 2; i < 52; i++) {
      idGen.nextIdent();
    }
    assert.equal(idGen.nextIdent(), "a0");
    for (let i = 1; i < 64; i++) {
      idGen.nextIdent();
    }
    assert.equal(idGen.nextIdent(), "b0");
    for (let i = 1; i < 64 * 51; i++) {
      idGen.nextIdent();
    }
    assert.equal(idGen.nextIdent(), "a00");
  }

  @test "has an case-insensitive ident generator"() {
    const idGen = new IdentGenerator(true);
    assert.equal(idGen.nextIdent(), "a");
    assert.equal(idGen.nextIdent(), "b");
    for (let i = 2; i < 26; i++) {
      idGen.nextIdent();
    }
    assert.equal(idGen.nextIdent(), "a0");
    for (let i = 1; i < 38; i++) {
      idGen.nextIdent();
    }
    assert.equal(idGen.nextIdent(), "b0");
    for (let i = 1; i < 38 * 25; i++) {
      idGen.nextIdent();
    }
    assert.equal(idGen.nextIdent(), "a00");
  }

  @test "can return an ident"() {
    const idGen = new IdentGenerator();
    assert.equal(idGen.nextIdent(), "a");
    idGen.returnIdent("a");
    assert.equal(idGen.nextIdent(), "a");
  }

  @test "ident generator set"() {
    const idGens = new IdentGenerators(false, "id", "class", "state");
    assert.equal(idGens.nextIdent("id"), "a");
    assert.equal(idGens.nextIdent("class"), "a");
    assert.equal(idGens.nextIdent("state"), "a");
    idGens.returnIdent("id", "a");
    assert.equal(idGens.nextIdent("id"), "a");
    assert.equal(idGens.nextIdent("class"), "b");
    assert.equal(idGens.nextIdent("state"), "b");
    try {
      const errorProneGen = new IdentGenerators<string>(false, "id", "class", "state");
      errorProneGen.nextIdent("foo");
      assert.fail("error expected");
    } catch (e) {
      assert.equal(e.message, "unknown ident namespace: foo");
    }
  }

  @test "leaves non-idents alone"() {
    let css1 = clean`
      a#id3 { border-width: 2px; }
      a, #id1 { text-decoration: underline; }
      p { font-weight: normal; }
      article #myId .foo a { color: red; }
    `;
    let template = new TestTemplate("test", clean`
      <article id="id1">
        <div id="myId">
          <p class="foo">
            <a id="id3">wtf</a>
          </p>
        </div>
      </article>
    `);
    return testRewriteIdents({ id: true, class: true }, css1, template).then(result => {
      assert.deepEqual(
        result.optimization.output.content.toString(),
        clean`
          a#a { border-width: 2px; }
          a, #b { text-decoration: underline; }
          p { font-weight: normal; }
          article #c .a a { color: red; }
        `);
      assert.deepEqual(documentToString(result.testedTemplates[0].assertionResults[0].actualDoc), clean`
      <article id="b">
        <div id="c">
          <p class="a">
            <a id="a">wtf</a>
          </p>
        </div>
      </article>
      `);
    });

  }

  @test "rewrites idents"() {
    let css1 = `
      #id3 { border-width: 2px; }
      #id1 { color: blue; }
      .thing1 { color: red; }
      #id2 { width: 50%; }
      .thing2 { border: 1px solid blue; }
      .thing3 { background: red; }
      div { background-color: white; }
      #id3.thing4 { border-color: black; }
    `;
    let template = new TestTemplate("test", clean`
      <div class="(thing3 | thing1)" id="(id1 | id2)"></div>
      <div class="(--- | thing2 | thing4)" id="id3"></div>
    `);
    return testRewriteIdents({ id: true, class: true }, css1, template).then(result => {
      let logString = result.optimization.actions.performed[0].logString();
      assert.equal(logString, `${path.resolve("test1.css")}:2:7 [rewriteIdents] Rewrote selector's idents from "#id3" to "#a".`);
      assert.equal(result.optimization.styleMapping.replacedAttributeCount(), 7);
      // debugResult(css1, result);
    });
  }

  @test "can disable id rewriting"() {
    let css1 = `
      #id3 { border-width: 2px; }
      #id1 { color: blue; }
      .thing1 { color: red; }
      #id2 { width: 50%; }
      .thing2 { border: 1px solid blue; }
      .thing3 { background: red; }
      div { background-color: white; }
      #id3.thing4 { border-color: black; }
    `;
    let template = new TestTemplate("test", clean`
      <div class="(thing3 | thing1)" id="(id1 | id2)"></div>
      <div class="(--- | thing2 | thing4)" id="id3"></div>
    `);
    return testRewriteIdents({ id: false, class: true }, css1, template).then(result => {
      let id1rw = result.optimization.styleMapping.getRewriteOf({ name: "id", value: "id1" });
      assert.isUndefined(id1rw);
      let thing1rw = result.optimization.styleMapping.getRewriteOf({ name: "class", value: "thing1" });
      assert.isDefined(thing1rw);
    });
  }
  @test "can disable class rewriting"() {
    let css1 = `
      #id3 { border-width: 2px; }
      #id1 { color: blue; }
      .thing1 { color: red; }
      #id2 { width: 50%; }
      .thing2 { border: 1px solid blue; }
      .thing3 { background: red; }
      div { background-color: white; }
      #id3.thing4 { border-color: black; }
    `;
    let template = new TestTemplate("test", clean`
      <div class="(thing3 | thing1)" id="(id1 | id2)"></div>
      <div class="(--- | thing2 | thing4)" id="id3"></div>
    `);
    return testRewriteIdents({ id: true, class: false }, css1, template).then(result => {
      let id1rw = result.optimization.styleMapping.getRewriteOf({ name: "id", value: "id1" });
      assert.isDefined(id1rw);
      let thing1rw = result.optimization.styleMapping.getRewriteOf({ name: "class", value: "thing1" });
      assert.isUndefined(thing1rw);
    });
  }
  @test "won't rewrite to existing idents"() {
    let css1 = `
      #id3 { border-width: 2px; }
      #a { color: blue; }
      .a { color: red; }
      #id2 { width: 50%; }
      .thing2 { border: 1px solid blue; }
      .thing3 { background: red; }
      div { background-color: white; }
      #id3.thing4 { border-color: black; }
    `;
    let template = new TestTemplate("test", clean`
      <div class="(thing3 | a)" id="(a | id2)"></div>
      <div class="(--- | thing2 | thing4)" id="id3"></div>
    `);
    return testRewriteIdents({ id: true, class: true }, css1, template).then(result => {
      // debugResult(css1, result);
      assert.equal(result.optimization.styleMapping.replacedAttributeCount(), 7);
      let tag = new Tagname({ constant: "div" });
      let classAttr = new Attribute("class", { constant: "a" });
      let mapping = result.optimization.styleMapping.rewriteMapping(new Element(tag, [classAttr]));
      if (mapping) {
        assert.deepEqual(mapping.inputs, [
          { "tagname": "div" },
          { "name": "class", "value": "a" },
        ]);
        assert.deepEqual(mapping.staticAttributes.class, ["b"]);
        assert.equal(result.optimization.output.content.toString(), "");
      }
    });
  }
}

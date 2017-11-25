import { and } from '../src/BooleanExpression';
import { Attribute, Element, Tagname, attrValues as v } from "@opticss/element-analysis";
import { SimpleAttribute, StyleMapping } from '../src/StyleMapping';
import {
  assert,
} from 'chai';
import {
  suite,
  test,
} from 'mocha-typescript';
import {
  isNotNull as assertNotNull,
  isDefined as assertDefined
} from "@opticss/util";
import {
  AttributeValueParser
} from "@opticss/attr-analysis-dsl";
import {
  normalizeTemplateOptions,
} from '../src/TemplateIntegrationOptions';

function sAttr(name: string, value: string): SimpleAttribute {
  return {name, value};
}

function sClass(...values: Array<string>): SimpleAttribute {
  if (values.length === 1) {
    return sAttr("class", values[0]);
  } else {
    return sAttr("class", values.join(" "));
  }
}

function attr(name: string, valueStr: string): Attribute {
  let parser = new AttributeValueParser(false);
  let result = parser.parse(null, name, valueStr);
  return new Attribute(name, result);
}

function element(tag: string, ...attrs: Array<Attribute>): Element {
  let tagname = new Tagname(tag === "?" ? v.unknown() : v.constant(tag));
  return new Element(tagname, attrs);
}

@suite("StyleMapping")
export class StyleMappingTest {
  @test "can rewrite a static attribute"() {
    let mapping = new StyleMapping(normalizeTemplateOptions({}));
    mapping.rewriteAttribute(sClass("test"), sClass("a"));
    let rewrite = mapping.rewriteMapping(element("?", attr("class", "test")));
    let staticClasses = rewrite.staticAttributes.class;
    assert(staticClasses.find(c => c === "a"), "rewritten class is missing");
    assert.isUndefined(staticClasses.find(c => c === "test"), "rewritten source class is present");
    assert.deepEqual(rewrite.dynamicAttributes, {id: {}, class: {}});
  }
  @test "can rewrite a dynamic attribute"() {
    let mapping = new StyleMapping(normalizeTemplateOptions({}));
    mapping.rewriteAttribute(sClass("test"), sClass("a"));
    let rewrite = mapping.rewriteMapping(element("?", attr("class", "(test|---)")));
    assertNotNull(rewrite).and(rewrite => {
      let dyn = rewrite.dynamicAttributes.class!["a"];
      assertDefined(dyn).and(dyn => {
        assert.deepEqual(dyn, and(0));
      });
    });
  }
  @test "can link a static attribute"() {
    let mapping = new StyleMapping(normalizeTemplateOptions({}));
    mapping.linkAttributes(sClass("a"), [{existing: [sClass("test")], unless: []}]);
    let rewrite = mapping.rewriteMapping(element("?", attr("class", "test")));
    assertNotNull(rewrite).and(rewrite => {
      assert.deepEqual(rewrite.inputs[0], {name: "class", value: "test"});
      let staticClasses = rewrite.staticAttributes.class;
      assert(staticClasses.find(c => c === "a"), "linked class is missing");
      assert(staticClasses.find(c => c === "test"), "source class is missing");
    });
  }
  @test "can link a dynamic attribute"() {
    let mapping = new StyleMapping(normalizeTemplateOptions({}));
    mapping.linkAttributes(sClass("a"), [{existing: [sClass("test")], unless: []}]);
    let rewrite = mapping.rewriteMapping(element("?", attr("class", "(test|---)")));
    assertNotNull(rewrite).and(rewrite => {
      assert.deepEqual(rewrite.inputs[0], {name: "class", value: "test"});
      let dyn = rewrite.dynamicAttributes.class!["a"];
      assertDefined(dyn).and(dyn => {
        assert.deepEqual(dyn, and(0));
      });
      let source = rewrite.dynamicAttributes.class!["test"];
      assertDefined(source).and(source => {
        assert.deepEqual(source, and(0));
      });
    });
  }
  @test "can obsolete an attribute"() {
    let mapping = new StyleMapping(normalizeTemplateOptions({}));
    mapping.attributeIsObsolete(sClass("test"));
    let rewrite = mapping.rewriteMapping(element("?", attr("class", "test")));
    assertNotNull(rewrite).and(rewrite => {
      assert.deepEqual(rewrite.inputs[0], {name: "class", value: "test"});
      assert.equal(Object.keys(rewrite.dynamicAttributes.class!).length, 0);
      assert.equal(rewrite.staticAttributes.class!.length, 0);
    });
  }
  @test "static attributes are static in the rewrite"() {
    let mapping = new StyleMapping(normalizeTemplateOptions({}));
    mapping.linkAttributes(sClass("a"), [{existing: [sClass("s_a")], unless: []}]);
    mapping.linkAttributes(sClass("a"), [{existing: [sClass("s_b")], unless: []}]);
    mapping.attributeIsObsolete(sClass("s_a"));
    let rewrite = mapping.rewriteMapping(element("?", attr("class", 's_a')));
    assert.deepEqual(rewrite.dynamicAttributes, { id: {}, class: {}});
    assert.deepEqual(rewrite.staticAttributes, {id: [], class: ['a']});
  }
  @test "classes can be both static and dynamic"() {
    let mapping = new StyleMapping(normalizeTemplateOptions({}));
    mapping.linkAttributes(sClass("a"), [{existing: [sClass("s_a")], unless: []}]);
    mapping.linkAttributes(sClass("b"), [{existing: [sClass("s_b")], unless: []}]);
    mapping.attributeIsObsolete(sClass("s_a"));
    mapping.attributeIsObsolete(sClass("s_b"));
    let rewrite = mapping.rewriteMapping(element("?", attr("class", 's_a (s_b|---)')));
    let inputs = (<SimpleAttribute[]>rewrite.inputs).map(a => a.value);

    assert.deepEqual(inputs, ["s_a", "s_b"]);
    assert.deepEqual(rewrite.staticAttributes, {id: [], class: ['a']});
    assert.deepEqual(rewrite.dynamicAttributes, { id: {}, class: {'b': {and: [1]}}});
  }
}
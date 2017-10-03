import { and } from '../src/BooleanExpression';
import { Attribute, AttributeValue, Element, Tagname, Value as v } from '../src/Selectable';
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
  let value: AttributeValue;
  if (/^([^?]+)?(\?|\?\?\?)([^?]+)?$/.test(valueStr)) {
    let startsWith = RegExp.$1;
    let unknown = RegExp.$2;
    let endsWith = RegExp.$3;
    let whitespace = false;
    if (unknown === "???") {
      whitespace = true;
    }
    if (startsWith && endsWith) {
      value = v.startsAndEndsWith(startsWith, endsWith, whitespace);
    } else if (startsWith) {
      value = v.startsWith(endsWith, whitespace);
    } else if (endsWith) {
      value = v.endsWith(endsWith, whitespace);
    } else if (unknown === "???") {
      value = v.unknown();
    } else {
      value = v.unknownIdentifier();
    }
  } else {
    value = v.constant(valueStr);
  }
  return new Attribute(name, value);
}

function element(tag: string, ...attrs: Array<Attribute>): Element {
  let tagname = new Tagname(tag === "?" ? v.unknown() : v.constant(tag));
  return new Element(tagname, attrs);
}

@suite("StyleMapping")
export class StyleMappingTest {
  @test "can rewrite an attribute"() {
    let mapping = new StyleMapping();
    mapping.rewriteAttribute(sClass("test"), sClass("a"));
    let rewrite = mapping.rewriteMapping(element("?", attr("class", "test")));
    assertNotNull(rewrite).and(rewrite => {
      let dyn = rewrite.dynamicAttributes.class!["a"];
      assertDefined(dyn).and(dyn => {
        assert.deepEqual(dyn, and(0));
      });
    });
  }
  @test "can link an attribute"() {
    let mapping = new StyleMapping();
    mapping.linkAttributes(sClass("a"), [{existing: [sClass("test")], unless: []}]);
    let rewrite = mapping.rewriteMapping(element("?", attr("class", "test")));
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
    let mapping = new StyleMapping();
    mapping.attributeIsObsolete(sClass("test"));
    let rewrite = mapping.rewriteMapping(element("?", attr("class", "test")));
    assertNotNull(rewrite).and(rewrite => {
      assert.deepEqual(rewrite.inputs[0], {name: "class", value: "test"});
      assert.equal(Object.keys(rewrite.dynamicAttributes.class!).length, 0);
      assert.equal(rewrite.staticAttributes.class!.length, 0);
    });
  }
}
import { assert } from 'chai';
import { suite, test } from 'mocha-typescript';
import {
  attrValues,
  AttributeValueSet,
  Element,
  Attribute,
  Tagname,
} from "../src";

@suite("Element Analysis")
export class ElementAnalysisTest {
  @test "attribute value generators"() {
    assert.deepEqual(attrValues.absent(), {absent: true});
    assert.deepEqual(attrValues.allOf([attrValues.constant("foo")]), {
      allOf: [{constant: "foo"}]
    });
  }
  @test "css-blocks class analysis"() {
    let value: AttributeValueSet = JSON.parse('{"allOf":[{"constant":"header__emphasis"},{"constant":"typography__underline"},{"oneOf":[{"allOf":[{"constant":"with-dynamic-classes__world"},{"oneOf":[{"absent":true},{"constant":"with-dynamic-classes__world--thick"}]}]},{"absent":true}]},{"oneOf":[{"absent":true},{"constant":"header__emphasis--style-bold"},{"constant":"header__emphasis--style-italic"}]}]}');
    let element = new Element(new Tagname(attrValues.constant('span')), [new Attribute("class", value)]);
    assert.deepEqual(element.toString(), '<span class="header__emphasis typography__underline (with-dynamic-classes__world (---|with-dynamic-classes__world--thick)|---) (---|header__emphasis--style-bold|header__emphasis--style-italic)">');
  }
}
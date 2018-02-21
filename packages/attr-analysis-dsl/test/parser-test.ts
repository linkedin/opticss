import {
  assert,
} from "chai";
import {
  suite,
  test,
} from "mocha-typescript";

import { AttributeValueParser } from "../src";

@suite("Simple Templates")
export class SimpleTemplateTest {
  @test "Can parse"() {
    let parser = new AttributeValueParser();
    let value = parser.parse(null, "class", "(foo | bar)");
    assert.deepEqual(value, {oneOf: [{constant: "foo"}, {constant: "bar"}]});
  }
}

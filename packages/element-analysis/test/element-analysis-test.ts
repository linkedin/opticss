import { assert } from 'chai';
import { suite, test } from 'mocha-typescript';
import {
  attrValues
} from "../src";

@suite("Element Analysis")
export class ElementAnalysisTest {
  @test "attribute value generators"() {
    assert.deepEqual(attrValues.absent(), {absent: true});
    assert.deepEqual(attrValues.allOf([attrValues.constant("foo")]), {
      allOf: [{constant: "foo"}]
    });
  }
}
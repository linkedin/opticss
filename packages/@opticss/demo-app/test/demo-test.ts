import { assert } from "chai";
import { skip, suite } from "mocha-typescript";

@suite("Demo App")
export class DemoAppTest {
  @skip "TODO: Write tests"() {
    assert.ok(1);
  }
}

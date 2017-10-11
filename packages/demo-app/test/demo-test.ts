import { assert } from 'chai';
import { suite, skip } from 'mocha-typescript';

@suite("Demo App")
export class DemoAppTest {
  @skip "TODO: Write tests"() {
    assert.ok(1);
  }
}

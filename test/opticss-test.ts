import { suite, test, skip, only } from "mocha-typescript";
import { assert } from "chai";

import { OptiCSS } from "../src/opticss";

@suite("OptiCSS")
export class OptiCSSTest {
  @test "can be constructed"() {
    let css = `.a { color: red; }`;
    let optimizer = new OptiCSS(css);
    assert.equal(optimizer.source, css);
  }
}
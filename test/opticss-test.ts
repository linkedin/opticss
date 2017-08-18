import { suite, test, skip, only } from "mocha-typescript";
import { assert } from "chai";

import { Optimizer } from "../src/Optimizer";

@suite("OptiCSS")
export class OptiCSSTest {
  @test "can be constructed"() {
    let css = `.a { color: red; }`;
    let optimizer = new Optimizer({});
    optimizer.addSource({content: css, filename: "test.css"});
    assert.equal(optimizer.sources[0].content, css);
  }
}
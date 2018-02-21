import {
  assert,
} from "chai";
import {
  suite,
  test,
} from "mocha-typescript";

import {
  Optimizer,
} from "../src/Optimizer";

@suite("OptiCSS")
export class OptiCSSTest {
  @test "can be constructed and get a non-optimized output"() {
    let css1 = `.a { color: red; }`;
    let css2 = `.b { width: 100%; }`;
    let optimizer = new Optimizer(
      { enabled: false },
      { rewriteIdents: { id: false, class: true }},
    );
    optimizer.addSource({content: css1, filename: "test1.css"});
    optimizer.addSource({content: css2, filename: "test2.css"});
    return optimizer.optimize("optimized.css").then(result => {
      let optimized = result.output.content.toString();
      assert.equal(optimized, `${css1}\n${css2}`);
    });
  }
}

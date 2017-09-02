import { suite, test, skip, only } from "mocha-typescript";
import { assert } from "chai";

import { Optimizer, OptimizationResult } from "../src/Optimizer";
import { TestTemplate } from "./util/TestTemplate";
import { SimpleAnalyzer } from "./util/SimpleAnalyzer";
import clean from "./util/clean";
import { RemoveRule, ChangeSelector } from "../src/Actions";
import * as path from "path";

@suite("OptiCSS")
export class OptiCSSTest {
  @test "can be constructed and get a non-optimized output"() {
    let css1 = `.a { color: red; }`;
    let css2 = `.b { width: 100%; }`;
    let optimizer = new Optimizer({
      enabled: false
    });
    optimizer.addSource({content: css1, filename: "test1.css"});
    optimizer.addSource({content: css2, filename: "test2.css"});
    return optimizer.optimize("optimized.css").then(result => {
      let optimized = result.output.content.toString();
      assert.equal(optimized, `${css1}\n${css2}`);
    });
  }
}
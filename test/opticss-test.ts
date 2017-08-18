import { suite, test, skip, only } from "mocha-typescript";
import { assert } from "chai";

import { Optimizer } from "../src/Optimizer";
import { TestTemplate } from "./util/TestTemplate";
import { SimpleAnalyzer } from "./util/SimpleAnalyzer";
import clean from "./util/clean";

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
  @test "Removes unused styles"() {
    let css1 = `.a { color: red; }`;
    let css2 = `.b { width: 100%; }`;
    let template = new TestTemplate("test", clean`
      <div class="b"></div>
    `);
    let analyzer = new SimpleAnalyzer(template);
    let analysis = analyzer.analyze();
    let optimizer = new Optimizer({
      only: ["removeUnusedStyles"]
    });
    optimizer.addSource({content: css1, filename: "test1.css"});
    optimizer.addSource({content: css2, filename: "test2.css"});
    optimizer.addAnalysis(analysis);
    return optimizer.optimize("optimized.css").then(result => {
      let optimized = result.output.content.toString();
      assert.equal(optimized, `\n${css2}`);
    });
  }
}
import { TestTemplate } from "@opticss/simple-template";
import { assert } from "chai";
import * as fs from "fs";
import {
  slow,
  suite,
  test,
  timeout,
} from "mocha-typescript";
import * as path from "path";

import { Warning } from "../src";

import {
  CascadeTestError,
  CascadeTestResult,
  debugCascadeError,
  debugError,
  logOptimizations,
  testOptimizationCascade,
} from "./util/assertCascade";

// import { debugSize } from "./util/assertSmaller";

function testDefaults(...stylesAndTemplates: Array<string | TestTemplate>): Promise<CascadeTestResult> {
  return testOptimizationCascade(
    { },
    {
      rewriteIdents: { id: true, class: true },
      analyzedAttributes: [],
      analyzedTagnames: true,
    },
    ...stylesAndTemplates).catch((e: CascadeTestError) => {
      debugError(stylesAndTemplates.filter(s => typeof s === "string").join("\n"), e);
      throw e;
    });
}

@suite("Integration Tests", slow(3000), timeout(5000))
export class IntegrationTests {
  @test "simple page"() {
    let css = fs.readFileSync(path.resolve(__dirname, "../../test/fixtures/integration-tests/simple/styles.css"), "utf-8");
    let markup = fs.readFileSync(path.resolve(__dirname, "../../test/fixtures/integration-tests/simple/markup.html"), "utf-8");
    let template = new TestTemplate("test", markup, true);
    return testDefaults(css, template).then(result => {
      let warnings = result.optimization.actions.performed.filter(a => a instanceof Warning);
      assert.equal(warnings.length, 3);
      assert.equal(warnings[0].logString(), `${process.cwd()}/test1.css:111:3 [mergeDeclarations] ` +
        `Unsupported property error: grid-template is not a supported property ` +
        `(long hands for this declaration with conflicting values will not be understood as such which could result in incorrect optimization output.)`);
      // logOptimizations(result.optimization);
      // return debugSize(result).then(() => {
      //   // debugResult(css, result);
      // });
    }).catch(e => {
      if (e.optimization) {
        logOptimizations(e.optimization);
      }
      debugCascadeError(e);
      throw e;
    });
  }
}

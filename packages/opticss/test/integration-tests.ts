import {
  TestTemplate,
} from "@opticss/simple-template";
import * as fs from "fs";
import {
  // slow,
  suite,
  test,
  // timeout,
} from "mocha-typescript";
import * as path from "path";

import {
  CascadeTestError,
  CascadeTestResult,
  debugCascadeError,
  debugError,
  debugResult,
  logOptimizations,
  testOptimizationCascade,
} from "./util/assertCascade";
import { debugSize } from "./util/assertSmaller";

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

@suite("Integration Tests")
export class IntegrationTests {
  @test "simple page"() {
    let css = fs.readFileSync(path.resolve(__dirname, "../../test/fixtures/integration-tests/simple/styles.css"), "utf-8");
    let markup = fs.readFileSync(path.resolve(__dirname, "../../test/fixtures/integration-tests/simple/markup.html"), "utf-8");
    let template = new TestTemplate("test", markup, true);
    return testDefaults(css, template).then(result => {
      logOptimizations(result.optimization);
      return debugSize(result).then(() => {
        debugResult(css, result);
      });
    }).catch(e => {
      logOptimizations(e.optimization);
      debugCascadeError(e);
      throw e;
    });
  }
}

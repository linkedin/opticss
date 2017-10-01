import { DemoOptimizer } from '../src/DemoOptimizer';
import {
  assert,
} from 'chai';
import {
  suite,
  test,
} from 'mocha-typescript';
import * as path from "path"
import * as fs from "fs"
import * as rimraf from "rimraf";
import * as mkdirp from "mkdirp";

const testDir = path.resolve(__dirname, "../../test");
let outputDir = path.join(testDir, "results");
console.log(testDir);

@suite("Demo CLI")
export class DemoCLITest {
  before() {
    rimraf.sync(outputDir)
    mkdirp.sync(outputDir);
  }
  @test "can be constructed and get optimized output"() {
    let htmlFile = path.join(testDir, "fixtures/single-file/input.html");
    let cssFile = path.join(testDir, "fixtures/single-file/input.css");
    let outputDir = path.join(testDir, "results");
    let cli = new DemoOptimizer(htmlFile, cssFile, outputDir);
    return cli.run().then(() => {
      assert(fs.existsSync(path.join(outputDir, "optimized.css")))
      assert(fs.existsSync(path.join(outputDir, "optimized.html")))
      assert(fs.existsSync(path.join(outputDir, "opticss.log")))
    })
  }
}
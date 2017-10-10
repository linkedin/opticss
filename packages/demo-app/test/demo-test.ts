// import { DemoOptimizer } from '../src/index';
// import {
//   assert,
// } from 'chai';
import {
  suite,
  skip,
} from 'mocha-typescript';
import * as path from "path";
// import * as fs from "fs";
import * as rimraf from "rimraf";
import * as mkdirp from "mkdirp";

const testDir = path.resolve(__dirname, "../../test");
let outputDir = path.join(testDir, "results");
console.log(testDir);

@suite("Demo APP")
export class DemoCLITest {
  before() {
    rimraf.sync(outputDir);
    mkdirp.sync(outputDir);
  }
  @skip "TODO: Write tests"() { }
}

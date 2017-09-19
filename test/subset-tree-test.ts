import { suite, test, only } from "mocha-typescript";
import { SubsetTree } from "../src/util/SubsetTree";
import { Set as TSCSet } from "typescript-collections";
import selectorParser = require("postcss-selector-parser");
import * as RandomJS from "random-js";
import { assert } from "chai";
import { getRandom } from "./util/randomness";

type TestSet = TSCSet<number>;

function isSubset(set1: TestSet, set2: TestSet): boolean {
  return set2.isSubsetOf(set1);
}

function numberToString(n: number) {
  return "" + n;
}

function newTestSet(...numbers: number[]): TestSet {
  let set = new TSCSet(numberToString);
  for (let n of numbers) {
    set.add(n);
  }
  return set;
}

@suite("Subset Tree")
export class SubsetTreeTest {
  random: RandomJS;
  before() {
    this.random = getRandom({});
  }
  @test "construction"() {
    let tree = new SubsetTree(isSubset);
    assert.equal(tree.size, 0);
  }

  @test "insertion"() {
    let tree = new SubsetTree(isSubset);
    let s1 = newTestSet(1, 2);
    let s2 = newTestSet(1, 2, 3);
    tree.insert(s1, s2);
    assert.equal(tree.size, 2);
  }

  @test "hasProperSuperset()"() {
    let tree = new SubsetTree(isSubset);
    let s1 = newTestSet(1, 2);
    let s2 = newTestSet(1, 2, 3);
    assert(s1.isSubsetOf(s2));
    tree.insert(s1, s2);
    assert.equal(tree.hasProperSupersetOf(s1), true);
  }

  @test "walks in correct order()"() {
    let sets = new Array<TestSet>();
    sets.push(newTestSet(1, 2));
    sets.push(newTestSet(1, 2, 3));
    sets.push(newTestSet(1));
    sets.push(newTestSet(3));
    sets.push(newTestSet(4));
    sets.push(newTestSet(5, 7, 9));
    sets.push(newTestSet(7, 9));
    sets.push(newTestSet(9, 10));
    sets.push(newTestSet(10, 11));
    sets.push(newTestSet(10));
    for (let x = 0; x < 10; x++) {
      let tree = new SubsetTree(isSubset);
      tree.insert(...this.random.shuffle(sets));
      // console.log("*************");
      // console.log(tree.debug());
      let traversed = new Array<TestSet>();
      for (let set of tree.walkSupersetOrder()) {
        for (let seen of traversed) {
          assert(!seen.isSubsetOf(set));
        }
        traversed.push(set);
      }
    }
  }

  @test "walk supersets of value."() {
    let sets = new Array<TestSet>();
    let subset = newTestSet(1);
    sets.push(newTestSet(1, 2));
    sets.push(newTestSet(1, 2, 3));
    sets.push(subset);
    sets.push(newTestSet(3));
    sets.push(newTestSet(4));
    sets.push(newTestSet(5, 7, 9));
    sets.push(newTestSet(7, 9));
    sets.push(newTestSet(9, 10));
    sets.push(newTestSet(10, 11));
    sets.push(newTestSet(10));

    let supersets = sets.filter(s => subset.isSubsetOf(s));
    let tree = new SubsetTree(isSubset);
    tree.insert(...this.random.shuffle(sets));
    let traversed = new Array<TestSet>();
    for (let set of tree.walkSupersetsOf(subset)) {
      for (let seen of traversed) {
        assert(supersets.includes(seen));
      }
      traversed.push(set);
    }
    assert.equal(traversed.length, supersets.length);
  }

}

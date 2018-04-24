import {
  assert,
} from "chai";
import {
  suite,
  test,
} from "mocha-typescript";

import { clean } from "../src/clean";
import { IdentityDictionary } from "../src/IdentityDictionary";
import { MultiMap } from "../src/MultiMap";
import { TwoKeyMultiMap } from "../src/TwoKeyMultiMap";
import * as typeAssertions from "../src/typedAssert";
import { ObjectDictionary } from "../src/UtilityTypes";

interface MultiMapKey1 {
  name: string;
}
interface MultiMapKey2 {
  label: string;
}
interface IdentityTest {
  key1: string;
  key2: number;
  other1: string;
}

@suite("Utils")
export class SimpleTemplateTest {
  @test "type assertions"() {
    let undef: string | undefined = (true) ? undefined : "apple";
    let defined: string | undefined = (true) ? "apple" : undefined;

    let nil: string | null = (true) ? null : "apple";
    let notNull: string | null = (true) ? "pear" : null;

    let nothing: string | null | undefined = (true) ? null : (false) ? "apple" : undefined;
    let something: string | null | undefined = (true) ? "apple" : (false) ? null : undefined;

    let apple = "apple";
    let pear = "pear";
    function isApple(x: string): x is "apple" {
      return x === "apple";
    }

    assert.throws(
       () => {
      typeAssertions.isDefined(undef).and((d: string) => d);
    }, "expected to be defined");

    let callbackInvoked = false;
    typeAssertions.isDefined(defined).and((d: string) => callbackInvoked = !!d);
    assert(callbackInvoked, "callback was not invoked.");

    assert.throws(
       () => {
      typeAssertions.isNotNull(nil).and((d: string) => d);
    }, "expected to not be null");

    callbackInvoked = false;
    typeAssertions.isNotNull(notNull).and((d: string) => callbackInvoked = !!d);
    assert(callbackInvoked, "callback was not invoked.");

    assert.throws(
       () => {
      typeAssertions.isExisting(nil).and((d: string) => d);
    }, "expected to exist");

    callbackInvoked = false;
    typeAssertions.isExisting(notNull).and((d: string) => callbackInvoked = !!d);
    assert(callbackInvoked, "callback was not invoked.");

    assert.throws(
       () => {
      typeAssertions.isExisting(undef).and((d: string) => d);
    }, "expected to exist");

    callbackInvoked = false;
    typeAssertions.isExisting(defined).and((d: string) => callbackInvoked = !!d);
    assert(callbackInvoked, "callback was not invoked.");

    assert.throws(
       () => {
      typeAssertions.isExisting(nothing).and((d: string) => d);
    }, "expected to exist");

    callbackInvoked = false;
    typeAssertions.isExisting(something).and((d: string) => callbackInvoked = !!d);
    assert(callbackInvoked, "callback was not invoked.");

    assert.throws(
       () => {
      typeAssertions.isType(isApple, pear).and((d: "apple") => d);
    }, "expected");

    callbackInvoked = false;
    typeAssertions.isType(isApple, apple).and((d: "apple") => callbackInvoked = !!d);
    assert(callbackInvoked, "callback was not invoked.");
  }

  @test "clean"() {
    // tslint:disable:no-trailing-whitespace
    assert.equal(
       clean`
      foo    
        bar   
    baz
    `, "foo\nbar\nbaz");
    // tslint:enable:no-trailing-whitespace
  }
  @test "Object Dictionary"() {
    let foo: ObjectDictionary<number> = {
      apple: 1,
      orange: 3,
    };
    assert.deepEqual(foo, {apple: 1, orange: 3});
  }
  @test "Identity Dictionary"() {
    let dict = new IdentityDictionary<IdentityTest>((it) => `${it.key1}:${it.key2}`);
    let one: IdentityTest = {
      key1: "apple",
      key2: 0,
      other1: "foo bar",
    };
    let onePrime: IdentityTest = {
      key1: "apple",
      key2: 0,
      other1: "different",
    };
    let two: IdentityTest = {
      key1: "orange",
      key2: 10,
      other1: "four score and twenty years ago",
    };
    let addedOne = dict.add(one);
    assert.strictEqual(addedOne, one);
    let addedOnePrime = dict.add(onePrime);
    assert.strictEqual(addedOnePrime, one);
    let addedTwo = dict.add(two);
    assert.strictEqual(addedTwo, two);
    assert.equal(dict.size(), 2);
    dict.update(one, (instance) => {
      assert.strictEqual(instance, one);
      instance.key1 = "green apple";
    });
    assert.equal(dict.size(), 2);
    assert.isFalse(dict.has(onePrime));
    let oneReplacement: IdentityTest = {
      key1: "bad apple",
      key2: 100,
      other1: "",
    };
    dict.update(one, (instance) => {
      assert.strictEqual(instance, one);
      return oneReplacement;
    });
    assert.equal(dict.size(), 2);
    assert.isTrue(dict.has(oneReplacement));
    dict.update(oneReplacement, (instance) => {
      assert.strictEqual(instance, oneReplacement);
      instance.key2 = 1000;
      return false;
    });
    assert.equal(dict.size(), 2);
    assert.isFalse(dict.has(oneReplacement));
    assert.isTrue(dict.has({
      key1: "bad apple",
      key2: 100,
      other1: "",
    }));
  }
  @test "MultiMap"() {
    let multiMap = new MultiMap<MultiMapKey1, number>();
    let key1 = {name: "key1"};
    multiMap.set(key1, 0);
    multiMap.set(key1, 1, 2);
    let values = multiMap.get(key1);
    assert.deepEqual(values, [0, 1, 2]);
    assert.strictEqual(multiMap.size, 1);
    assert.strictEqual(multiMap.sizeOfKeys, 1);
    assert.strictEqual(multiMap.sizeOfValues, 3);
    // can iterate entries
    let entries = new Array<[MultiMapKey1, number[]]>();
    for (let entry of multiMap.entries()) {
      entries.push(entry);
    }
    assert.deepEqual(entries, [[key1, [0, 1, 2]]]);
    // can iterate entries individually
    let individualEntries = new Array<[MultiMapKey1, number]>();
    for (let entry of multiMap.individualEntries()) {
      individualEntries.push(entry);
    }
    assert.deepEqual(individualEntries, [[key1, 0], [key1, 1], [key1, 2]]);
    // deleting one value
    multiMap.deleteValue(key1, 1);
    assert.deepEqual(multiMap.get(key1), [0, 2]);
    assert.strictEqual(multiMap.sizeOfKeys, 1);
    assert.strictEqual(multiMap.sizeOfValues, 2);
    // deleting all the values, deleting values that aren't there.
    assert.deepEqual(multiMap.deleteValue(key1, 0, 2, 3), [0, 2]);
    assert.strictEqual(multiMap.sizeOfKeys, 0);
    assert.strictEqual(multiMap.sizeOfValues, 0);
    // adding and deleting several values that are the same.
    multiMap.set(key1, 1, 1, 1);
    assert.strictEqual(multiMap.sizeOfKeys, 1);
    assert.strictEqual(multiMap.sizeOfValues, 3);
    assert.deepEqual(multiMap.deleteValue(key1, 1), [1, 1, 1]);
    assert.strictEqual(multiMap.sizeOfKeys, 0);
    assert.strictEqual(multiMap.sizeOfValues, 0);
    // ensure that we can clear the map
    multiMap.set(key1, 0, 1, 2);
    multiMap.clear();
    assert.strictEqual(multiMap.size, 0);
    assert.strictEqual(multiMap.sizeOfKeys, 0);
    assert.strictEqual(multiMap.sizeOfValues, 0);
    // this is an instance-based map, not an equality-based map.
    multiMap.set(key1, 1);
    multiMap.set({name: "key1"}, 2);
    assert.strictEqual(multiMap.sizeOfKeys, 2);
    assert.strictEqual(multiMap.sizeOfValues, 2);
    // A missing key returns an empty array
    multiMap.clear();
    assert.deepEqual(multiMap.get(key1), []);
    assert.deepEqual(multiMap.has(key1), false);
    // No side effects by mutating return values.
    let emptyValue = multiMap.get(key1);
    emptyValue.push(2);
    assert.deepEqual(multiMap.get(key1), []);
    multiMap.set(key1, 1);
    let existingValue = multiMap.get(key1);
    existingValue.push(2);
    assert.deepEqual(multiMap.get(key1), [1]);
    for (let [_key, values] of multiMap.entries()) {
      values.push(2);
    }
    assert.deepEqual(multiMap.get(key1), [1]);
    for (let values of multiMap.values()) {
      values.push(2);
    }
    assert.deepEqual(multiMap.get(key1), [1]);
    multiMap.forEach((values) => {
      values.push(2);
    });
    assert.deepEqual(multiMap.get(key1), [1]);
  }
  @test "MultiMap with unique values"() {
    let multiMap = new MultiMap<MultiMapKey1, number>(false);
    let key1 = {name: "key1"};
    multiMap.set(key1, 0);
    multiMap.set(key1, 1, 2);
    let values = multiMap.get(key1);
    assert.deepEqual(values, [0, 1, 2]);
    assert.strictEqual(multiMap.size, 1);
    assert.strictEqual(multiMap.sizeOfKeys, 1);
    assert.strictEqual(multiMap.sizeOfValues, 3);
    // can iterate entries
    let entries = new Array<[MultiMapKey1, number[]]>();
    for (let entry of multiMap.entries()) {
      entries.push(entry);
    }
    assert.deepEqual(entries, [[key1, [0, 1, 2]]]);
    // can iterate entries individually
    let individualEntries = new Array<[MultiMapKey1, number]>();
    for (let entry of multiMap.individualEntries()) {
      individualEntries.push(entry);
    }
    assert.deepEqual(individualEntries, [[key1, 0], [key1, 1], [key1, 2]]);
    // deleting one value
    multiMap.deleteValue(key1, 1);
    assert.deepEqual(multiMap.get(key1), [0, 2]);
    assert.strictEqual(multiMap.sizeOfKeys, 1);
    assert.strictEqual(multiMap.sizeOfValues, 2);
    // deleting all the values, deleting values that aren't there.
    assert.deepEqual(multiMap.deleteValue(key1, 0, 2, 3), [0, 2]);
    assert.strictEqual(multiMap.sizeOfKeys, 0);
    assert.strictEqual(multiMap.sizeOfValues, 0);
    // adding and deleting several values that are the same.
    multiMap.set(key1, 1, 1, 1);
    assert.strictEqual(multiMap.sizeOfKeys, 1);
    assert.strictEqual(multiMap.sizeOfValues, 1);
    assert.deepEqual(multiMap.deleteValue(key1, 1), [1]);
    assert.strictEqual(multiMap.sizeOfKeys, 0);
    assert.strictEqual(multiMap.sizeOfValues, 0);
    // ensure that we can clear the map
    multiMap.set(key1, 0, 1, 2);
    multiMap.clear();
    assert.strictEqual(multiMap.size, 0);
    assert.strictEqual(multiMap.sizeOfKeys, 0);
    assert.strictEqual(multiMap.sizeOfValues, 0);
    // this is an instance-based map, not an equality-based map.
    multiMap.set(key1, 1);
    multiMap.set({name: "key1"}, 2);
    assert.strictEqual(multiMap.sizeOfKeys, 2);
    assert.strictEqual(multiMap.sizeOfValues, 2);
    // A missing key returns an empty array
    multiMap.clear();
    assert.deepEqual(multiMap.get(key1), []);
    assert.deepEqual(multiMap.has(key1), false);
    // No side effects by mutating return values.
    let emptyValue = multiMap.get(key1);
    emptyValue.push(2);
    assert.deepEqual(multiMap.get(key1), []);
    multiMap.set(key1, 1);
    let existingValue = multiMap.get(key1);
    existingValue.push(2);
    assert.deepEqual(multiMap.get(key1), [1]);
    for (let [_key, values] of multiMap.entries()) {
      values.push(2);
    }
    assert.deepEqual(multiMap.get(key1), [1]);
    for (let values of multiMap.values()) {
      values.push(2);
    }
    assert.deepEqual(multiMap.get(key1), [1]);
    multiMap.forEach((values) => {
      values.push(2);
    });
    assert.deepEqual(multiMap.get(key1), [1]);
  }
  @test "TwoKeyMultiMap"() {
    let multiMap = new TwoKeyMultiMap<MultiMapKey1, MultiMapKey2, number>();
    let key1 = {name: "key1"};
    let key2 = {label: "key2"};
    multiMap.set(key1, key2, 0);
    multiMap.set(key1, key2, 1, 2);
    let values = multiMap.get(key1, key2);
    assert.deepEqual(values, [0, 1, 2]);
    assert.strictEqual(multiMap.size, 1);
    assert.strictEqual(multiMap.sizeOfKeys, 1);
    assert.strictEqual(multiMap.sizeOfValues, 3);
    // can iterate entries
    let entries = new Array<[MultiMapKey1, MultiMapKey2, number[]]>();
    for (let entry of multiMap.entries()) {
      entries.push(entry);
    }
    assert.deepEqual(entries, [[key1, key2, [0, 1, 2]]]);
    // can iterate entries individually
    let individualEntries = new Array<[MultiMapKey1, MultiMapKey2, number]>();
    for (let entry of multiMap.individualEntries()) {
      individualEntries.push(entry);
    }
    assert.deepEqual(individualEntries, [[key1, key2, 0], [key1, key2, 1], [key1, key2, 2]]);
    // deleting one value
    multiMap.deleteValue(key1, key2, 1);
    assert.deepEqual(multiMap.get(key1, key2), [0, 2]);
    assert.strictEqual(multiMap.sizeOfKeys, 1);
    assert.strictEqual(multiMap.sizeOfValues, 2);
    // deleting all the values, deleting values that aren't there.
    assert.deepEqual(multiMap.deleteValue(key1, key2, 0, 2, 3), [0, 2]);
    assert.strictEqual(multiMap.sizeOfKeys, 0);
    assert.strictEqual(multiMap.sizeOfValues, 0);
    // adding and deleting several values that are the same.
    multiMap.set(key1, key2, 1, 1, 1);
    assert.strictEqual(multiMap.sizeOfKeys, 1);
    assert.strictEqual(multiMap.sizeOfValues, 3);
    assert.deepEqual(multiMap.deleteValue(key1, key2, 1), [1, 1, 1]);
    assert.strictEqual(multiMap.sizeOfKeys, 0);
    assert.strictEqual(multiMap.sizeOfValues, 0);
    // ensure that we can clear the map
    multiMap.set(key1, key2, 0, 1, 2);
    multiMap.clear();
    assert.strictEqual(multiMap.size, 0);
    assert.strictEqual(multiMap.sizeOfKeys, 0);
    assert.strictEqual(multiMap.sizeOfValues, 0);
    // this is an instance-based map, not an equality-based map.
    multiMap.set(key1, key2, 1);
    multiMap.set({name: "key1"}, {label: "key2"}, 2);
    assert.strictEqual(multiMap.sizeOfKeys, 2);
    assert.strictEqual(multiMap.sizeOfValues, 2);
    // A missing key returns an empty array
    multiMap.clear();
    assert.deepEqual(multiMap.get(key1, key2), []);
    assert.deepEqual(multiMap.has(key1, key2), false);
    // No side effects by mutating return values.
    let emptyValue = multiMap.get(key1, key2);
    emptyValue.push(2);
    assert.deepEqual(multiMap.get(key1, key2), []);
    multiMap.set(key1, key2, 1);
    let existingValue = multiMap.get(key1, key2);
    existingValue.push(2);
    assert.deepEqual(multiMap.get(key1, key2), [1]);
    for (let [_key1, _key2, values] of multiMap.entries()) {
      values.push(2);
    }
    assert.deepEqual(multiMap.get(key1, key2), [1]);
    for (let values of multiMap.values()) {
      values.push(2);
    }
    assert.deepEqual(multiMap.get(key1, key2), [1]);
    multiMap.forEach((values) => {
      values.push(2);
    });
    assert.deepEqual(multiMap.get(key1, key2), [1]);
  }
  @test "TwoKeyMultiMap with distinct values"() {
    let multiMap = new TwoKeyMultiMap<MultiMapKey1, MultiMapKey2, number>(false);
    let key1 = {name: "key1"};
    let key2 = {label: "key2"};
    multiMap.set(key1, key2, 0);
    multiMap.set(key1, key2, 1, 2);
    let values = multiMap.get(key1, key2);
    assert.deepEqual(values, [0, 1, 2]);
    assert.strictEqual(multiMap.size, 1);
    assert.strictEqual(multiMap.sizeOfKeys, 1);
    assert.strictEqual(multiMap.sizeOfValues, 3);
    // can iterate entries
    let entries = new Array<[MultiMapKey1, MultiMapKey2, number[]]>();
    for (let entry of multiMap.entries()) {
      entries.push(entry);
    }
    assert.deepEqual(entries, [[key1, key2, [0, 1, 2]]]);
    // can iterate entries individually
    let individualEntries = new Array<[MultiMapKey1, MultiMapKey2, number]>();
    for (let entry of multiMap.individualEntries()) {
      individualEntries.push(entry);
    }
    assert.deepEqual(individualEntries, [[key1, key2, 0], [key1, key2, 1], [key1, key2, 2]]);
    // deleting one value
    multiMap.deleteValue(key1, key2, 1);
    assert.deepEqual(multiMap.get(key1, key2), [0, 2]);
    assert.strictEqual(multiMap.sizeOfKeys, 1);
    assert.strictEqual(multiMap.sizeOfValues, 2);
    // deleting all the values, deleting values that aren't there.
    assert.deepEqual(multiMap.deleteValue(key1, key2, 0, 2, 3), [0, 2]);
    assert.strictEqual(multiMap.sizeOfKeys, 0);
    assert.strictEqual(multiMap.sizeOfValues, 0);
    // adding and deleting several values that are the same.
    multiMap.set(key1, key2, 1, 1, 1);
    assert.strictEqual(multiMap.sizeOfKeys, 1);
    assert.strictEqual(multiMap.sizeOfValues, 1);
    assert.deepEqual(multiMap.deleteValue(key1, key2, 1), [1]);
    assert.strictEqual(multiMap.sizeOfKeys, 0);
    assert.strictEqual(multiMap.sizeOfValues, 0);
    // ensure that we can clear the map
    multiMap.set(key1, key2, 0, 1, 2);
    multiMap.clear();
    assert.strictEqual(multiMap.size, 0);
    assert.strictEqual(multiMap.sizeOfKeys, 0);
    assert.strictEqual(multiMap.sizeOfValues, 0);
    // this is an instance-based map, not an equality-based map.
    multiMap.set(key1, key2, 1);
    multiMap.set({name: "key1"}, {label: "key2"}, 2);
    assert.strictEqual(multiMap.sizeOfKeys, 2);
    assert.strictEqual(multiMap.sizeOfValues, 2);
    // A missing key returns an empty array
    multiMap.clear();
    assert.deepEqual(multiMap.get(key1, key2), []);
    assert.deepEqual(multiMap.has(key1, key2), false);
    // No side effects by mutating return values.
    let emptyValue = multiMap.get(key1, key2);
    emptyValue.push(2);
    assert.deepEqual(multiMap.get(key1, key2), []);
    multiMap.set(key1, key2, 1);
    let existingValue = multiMap.get(key1, key2);
    existingValue.push(2);
    assert.deepEqual(multiMap.get(key1, key2), [1]);
    for (let [_key1, _key2, values] of multiMap.entries()) {
      values.push(2);
    }
    assert.deepEqual(multiMap.get(key1, key2), [1]);
    for (let values of multiMap.values()) {
      values.push(2);
    }
    assert.deepEqual(multiMap.get(key1, key2), [1]);
    multiMap.forEach((values) => {
      values.push(2);
    });
    assert.deepEqual(multiMap.get(key1, key2), [1]);
  }
}

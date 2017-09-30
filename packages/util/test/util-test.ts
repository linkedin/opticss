import { IdentityDictionary } from '../src/IdentityDictionary';
import { ObjectDictionary } from '../src/UtilityTypes';
import {
  assert,
} from 'chai';
import {
  suite,
  test,
} from 'mocha-typescript';
import clean from "../src/clean";

interface IdentityTest {
  key1: string;
  key2: number;
  other1: string;
}

@suite("Utils")
export class SimpleTemplateTest {
  @test "clean"() {
    // tslint:disable:no-trailing-whitespace
    assert.equal(clean`
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
      other1: "foo bar"
    };
    let onePrime: IdentityTest = {
      key1: "apple",
      key2: 0,
      other1: "different"
    };
    let two: IdentityTest = {
      key1: "orange",
      key2: 10,
      other1: "four score and twenty years ago"
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
      other1: ""
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
      other1: ""
    }));
  }
}
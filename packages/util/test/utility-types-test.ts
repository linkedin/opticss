import {
  assert,
} from "chai";
import {
  suite,
  test,
} from "mocha-typescript";

import {
  firstOfType,
  ItemType,
  ObjectDictionary,
  objectDictionaryFromMap,
} from "../src";

interface Association<Key, Value> {
  key: Key;
  info: Value;
}

interface StringKeyInfo {
  keyIndexes: Array<Association<string, number>>;
  keyIsSet: Array<Association<string, boolean>>;
}
class StringKeys {
  private info: StringKeyInfo;
  keys: Array<string>;
  constructor() {
    this.info = initializeStringKeyInfo("");
    this.keys = [""];
  }
  add(key: string) {
    let index = this.keys.length;
    this.info.keyIndexes.push({key, info: index});
    this.info.keyIsSet.push({key, info: true});
  }
}

function initializeStringKeyInfo(key: string): StringKeyInfo {
  let keyIndexesDefault: ItemType<StringKeyInfo["keyIndexes"]> = {key, info: 0};
  let keyIsSetDefault: ItemType<StringKeyInfo["keyIsSet"]> = {key, info: true};
  return {
    keyIndexes: [keyIndexesDefault],
    keyIsSet: [keyIsSetDefault],
  };
}

interface FirstOfTypeA {
  type: "1A";
}
interface FirstOfTypeB {
  type: "1B";
}

type FirstOfTypes = FirstOfTypeA | FirstOfTypeB;

function isTypeA(o: object): o is FirstOfTypeA {
  return (<Partial<FirstOfTypeA>>o).type === "1A";
}

@suite("Simple Templates")
export class SimpleTemplateTest {
  @test "ItemType example"() {
    let foo = new StringKeys();
    assert.deepEqual(foo, foo);
  }
  @test "firstOfType"() {
    let a = new Array<FirstOfTypes>();
    let n = firstOfType(a, isTypeA);
    assert.isUndefined(n);
    a.push({type: "1B"});
    a.push({type: "1B"});
    a.push({type: "1A"});
    a.push({type: "1B"});
    n = firstOfType(a, isTypeA);
    assert.isDefined(n);
    assert.deepEqual(n, {type: "1A"});
  }
  @test "objectDictionaryFromMap"() {
    let m = new Map<string, number>();
    m.set("c", 3);
    m.set("a", 1);
    m.set("b", 2);
    let d: ObjectDictionary<number> = {
      a: 1,
      b: 2,
      c: 3,
    };
    assert.deepEqual(objectDictionaryFromMap(m), d);
  }
}

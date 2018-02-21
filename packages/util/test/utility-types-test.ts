import {
  assert,
} from "chai";
import {
  suite,
  test,
} from "mocha-typescript";

import { ItemType } from "../src";

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

@suite("Simple Templates")
export class SimpleTemplateTest {
  @test "ItemType example"() {
    let foo = new StringKeys();
    assert.deepEqual(foo, foo);
  }
}

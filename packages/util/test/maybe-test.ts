import { assert } from "chai";
import { suite, test } from "mocha-typescript";

import { MAYBE, Maybe, NO_VALUE, None, attempt, callMaybe, isMaybe, isNone, isSome, maybe, methodMaybe, none, some, unwrap } from "../src/Maybe";
import * as typedAssert from "../src/typedAssert";

@suite("Maybe")
export class MaybeTest {
  @test "can be constructed"() {
    let some = maybe(0);
    let someWithError = maybe(0, "my custom error message");
    let none = maybe(undefined);
    let noneWithError = maybe(undefined, "my custom error message");
    assert.deepEqual(some, {[MAYBE]: 0});
    assert.deepEqual(someWithError, {[MAYBE]: 0});
    assert.deepEqual(none, {[MAYBE]: NO_VALUE, error: undefined});
    assert.deepEqual(noneWithError, {[MAYBE]: NO_VALUE, error: "my custom error message"});
  }
  @test "can be checked if it isSome"() {
    assert.isTrue(isSome(some(1)));
    assert.isFalse(isSome(none()));
    assert.isTrue(isSome(some(false)));
  }
  @test "can be checked if it isNone"() {
    assert.isFalse(isNone(some(1)));
    assert.isTrue(isNone(none()));
  }
  @test "can be checked if it isMaybe"() {
    assert.isTrue(isMaybe(some(1)));
    assert.isTrue(isMaybe(none()));
    assert.isFalse(isMaybe(undefined));
    assert.isFalse(isMaybe(null));
    assert.isFalse(isMaybe("a string"));
    assert.isFalse(isMaybe(true));
  }
  @test "unwrapping Some returns the value."() {
    assert.equal(5, unwrap(maybe(5)));
    assert.equal(false, unwrap(maybe(false)));
    let s = Symbol();
    assert.equal(s, unwrap(some(s)));
  }
  @test "unwrapping None throws an error."() {
    try {
      unwrap(none());
      assert(false);
    } catch (e) {
      assert.equal(e.message, "A value was expected.");
    }
    try {
      unwrap(none("foo"));
      assert(false);
    } catch (e) {
      assert.equal(e.message, "foo");
    }
  }
  @test "conditionally call a function with arity of 1"() {
    let wasCalled = false;
    let addOne = (n: number) => { wasCalled = true; return n + 1; };
    assert.equal(unwrap(callMaybe(addOne, 4)), 5);
    assert.isTrue(wasCalled);
    wasCalled = false;
    assert.equal(unwrap(callMaybe(addOne, some(4))), 5);
    assert.isTrue(wasCalled);
    wasCalled = false;
    assert.isTrue(isNone(callMaybe(addOne, none())));
    assert.isFalse(wasCalled);
    wasCalled = false;
  }
  @test "conditionally call a function with arity of 1 that accepts undefined"() {
    let wasCalled = false;
    let addOne = (n: number | undefined) => { wasCalled = true; return (n || 0) + 1; };
    assert.equal(unwrap(callMaybe(addOne, 4)), 5);
    assert.isTrue(wasCalled);
    wasCalled = false;
    assert.equal(unwrap(callMaybe(addOne, undefined)), 1);
    assert.isTrue(wasCalled);
    wasCalled = false;
    assert.equal(unwrap(callMaybe(addOne, some(4))), 5);
    assert.isTrue(wasCalled);
    wasCalled = false;
  }
  @test "conditionally call a function with arity of 2"() {
    let wasCalled = false;
    let addTogether = (a: number, b: number) => { wasCalled = true; return a + b; };
    assert.equal(unwrap(callMaybe(addTogether, 4, 1)), 5);
    assert.isTrue(wasCalled);
    wasCalled = false;
    assert.equal(unwrap(callMaybe(addTogether, some(4), 1)), 5);
    assert.isTrue(wasCalled);
    wasCalled = false;
    assert.equal(unwrap(callMaybe(addTogether, 4, some(1))), 5);
    assert.isTrue(wasCalled);
    wasCalled = false;
    assert.isTrue(isNone(callMaybe(addTogether, none(), 1)));
    assert.isFalse(wasCalled);
    wasCalled = false;
    assert.isTrue(isNone(callMaybe(addTogether, 4, none())));
    assert.isFalse(wasCalled);
    wasCalled = false;
  }
  @test "conditionally call a function with arity of 3"() {
    let wasCalled = false;
    let makeMessage = (a: string, b: number, c: {a: number}) => { wasCalled = true; return `${a} ${b} ${c.a}`; };
    assert.equal(unwrap(callMaybe(makeMessage, "hi", 1, {a: 42})), "hi 1 42");
    assert.isTrue(wasCalled);
    wasCalled = false;
    assert.equal(unwrap(callMaybe(makeMessage, some("hi"), some(1), some({a: 42}))), "hi 1 42");
    assert.isTrue(wasCalled);
    wasCalled = false;
    assert.equal(unwrap(callMaybe(makeMessage, some("hi"), 1, some({a: 42}))), "hi 1 42");
    assert.isTrue(wasCalled);
    wasCalled = false;
    assert.isTrue(isNone(callMaybe(makeMessage, none(), 1, {a: 1})));
    assert.isFalse(wasCalled);
    wasCalled = false;
    assert.isTrue(isNone(callMaybe(makeMessage, some("yo"), none(), {a: 42})));
    assert.isFalse(wasCalled);
    wasCalled = false;
    assert.isTrue(isNone(callMaybe(makeMessage, some("yo"), 5, none())));
    assert.isFalse(wasCalled);
    wasCalled = false;
  }
  @test "conditionally call a function with arity of 4"() {
    let wasCalled = false;
    let makeMessage = (a: string, b: number, c: {a: number}, d: boolean) => { wasCalled = true; return `${a} ${b} ${c.a} ${d}`; };
    assert.equal(unwrap(callMaybe(makeMessage, "hi", 1, {a: 42}, true)), "hi 1 42 true");
    assert.isTrue(wasCalled);
    wasCalled = false;
    assert.equal(unwrap(callMaybe(makeMessage, some("hi"), some(1), some({a: 42}), some(false))), "hi 1 42 false");
    assert.isTrue(wasCalled);
    wasCalled = false;
    assert.isTrue(isNone(callMaybe(makeMessage, none(), 1, {a: 1}, false)));
    assert.isFalse(wasCalled);
    wasCalled = false;
  }
  @test "conditionally call a method with no arguments"() {
    let wasCalled = false;
    let obj = some({
      myMethod(): number {
        wasCalled = true;
        return 42;
      },
    });
    assert.equal(unwrap(methodMaybe(obj, "myMethod")), 42);
    assert.isTrue(wasCalled);
    wasCalled = false;
    function getNoObj(): Maybe<{myMethod(): number}> {
      wasCalled = true;
      return none();
    }
    let noObj = getNoObj();
    assert.equal(methodMaybe(noObj, "myMethod"), noObj);
    assert.isTrue(wasCalled);
  }
  @test "conditionally call a method with one argument"() {
    let wasCalled = false;
    let obj = some({
      myMethod(n: number): number {
        wasCalled = true;
        return n + 41;
      },
    });
    assert.equal(unwrap(methodMaybe(obj, "myMethod", 1)), 42);
    assert.isTrue(wasCalled);
    wasCalled = false;
    function getNoObj(): Maybe<{myMethod(n: number): number}> {
      wasCalled = true;
      return none();
    }
    let noObj = getNoObj();
    let result: Maybe<number> = methodMaybe(noObj, "myMethod", 1);
    typedAssert.isType(isNone, noObj).and((n: None) => {
      assert.equal(result, n);
    });
    assert.isTrue(wasCalled);
  }
  @test "attempt an operation"() {
    assert.equal(unwrap(attempt(() => 42)), 42);
    let error = new Error("gonna throw this");
    let maybe = attempt(() => {
      throw error;
    });
    assert.isTrue(isNone(maybe));
    try {
      unwrap(maybe);
      assert("should have thrown");
    } catch (e) {
      assert.equal(e, error);
    }
  }
}

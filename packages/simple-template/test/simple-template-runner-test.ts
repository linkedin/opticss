import {
  assert,
} from 'chai';
import {
  only,
  suite,
  test,
} from 'mocha-typescript';
import {
  SimpleTemplateRunner,
  TestTemplate,
} from '../src';

import { clean } from "@opticss/util";

@suite("Simple Template Runner")
export class SimpleTemplateTest {
  @test "Can run once"() {
    let template =  new TestTemplate("test.tmpl", `<div class="(foo | bar)"></div>`);
    let runner = new SimpleTemplateRunner(template);
    return runner.runOnce().then(value => {
      assert.deepEqual(value, `<div class="foo"></div>`);
    });
  }
  @test "Can run once with an optional value"() {
    let template =  new TestTemplate("test.tmpl", `<div class="(foo | ---)"></div>`);
    let runner = new SimpleTemplateRunner(template);
    return runner.runOnce().then(value => {
      assert.deepEqual(value, `<div class="foo"></div>`);
    });
  }
  @test "Can run all with an optional value"() {
    let template =  new TestTemplate("test.tmpl", `<div class="(foo | ---)"></div>`);
    let runner = new SimpleTemplateRunner(template);
    return runner.runAll().then(value => {
      assert.deepEqual(value[0], `<div class="foo"></div>`);
      assert.deepEqual(value[1], `<div class=""></div>`);
    });
  }
  @only
  @test "Can run all with an optional value 2"() {
    let template =  new TestTemplate("test.tmpl", clean`
    <div class="frozen orange">ORANGE</div>
    <div class="apple">APPLE</div>
    <div class="strawberry (frozen|---)">STRAWBERRY</div>`);
    let runner = new SimpleTemplateRunner(template);
    return runner.runAll().then(value => {
      assert.deepEqual(value[0], clean`<div class="frozen orange">ORANGE</div>
      <div class="apple">APPLE</div>
      <div class="strawberry frozen">STRAWBERRY</div>`);
      assert.deepEqual(value[1], clean`<div class="frozen orange">ORANGE</div>
      <div class="apple">APPLE</div>
      <div class="strawberry">STRAWBERRY</div>`);
    });
  }
}
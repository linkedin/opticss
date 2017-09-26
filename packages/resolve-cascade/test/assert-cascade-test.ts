import {
  assertSameCascade,
} from '../src';
import { suite, test, skip, only } from "mocha-typescript";
import { assert } from "chai";

import clean from "./util/clean";
import * as path from 'path';

@suite("Cascade")
export class CascadeTest {
  @test "can assert cascades match"() {
    let expectedCss = clean`
      #c { background-color: #F00; }
      .a { color: red; }
      .b { background: none; }
    `;
    let expectedHtml = clean`
      <div id="c" class="a b"></div>
    `;
    let actualCss = clean`
      .everything {
        background: none #F00;
        color: red;
      }
    `;
    let actualHtml = clean`
      <div class="everything"></div>
    `;

    return assertSameCascade(expectedCss, actualCss, expectedHtml, actualHtml).then(result => {
      result.actualFullCascade.forEach(element => {
        let style = element.compute();
        assert.equal(style.color, "red");
      })
    });
  }
}
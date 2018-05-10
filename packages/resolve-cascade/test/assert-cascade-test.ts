import { clean } from "../../@opticss/util/src";
import {
  assert,
} from "chai";
import {
  suite,
  test,
} from "mocha-typescript";

import {
  assertSameCascade,
} from "../src";

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
      });
    });
  }
  @test "initial values are equivalent"() {
    let expectedCss = clean`
      .a { position: static; }
      .b { background: none; }
    `;
    let expectedHtml = clean`
      <div class="a"></div>
      <div class="b"></div>
    `;
    let actualCss = clean`
      .a { position: initial; }
      .b { background: none transparent; }
    `;
    let actualHtml = clean`
      <div class="a"></div>
      <div class="b"></div>
    `;

    return assertSameCascade(expectedCss, actualCss,
                             expectedHtml, actualHtml).then(() => {});
  }
}

import { clean } from "../../@opticss/util/src";
import {
  assert,
} from "chai";
import {
  suite,
  test,
} from "mocha-typescript";

import {
  Cascade,
} from "../src/Cascade";
import {
  bodyElement,
  parseHtml,
  walkElements,
} from "../src/util";

@suite("Cascade")
export class CascadeTest {
  @test "can compute a simple style"() {
    let css = clean`
      .a { color: red; }
    `;
    let html = clean`
      <div class="a"></div>
    `;
    let document = parseHtml(html);
    let body = bodyElement(document)!;
    let cascade = new Cascade(css, document);
    return cascade.perform().then(cascadedStyles => {
      walkElements(body, (node) => {
        let elStyle = cascadedStyles.get(node);
        if (elStyle) {
          let styles = elStyle.compute();
          assert.equal(styles.color, "red");
        }
      });
    });
  }
  @test "can be constructed"() {
    let css = clean`
      #c { background-color: #F00; }
      .a { color: red; }
      .b { background: none; }
    `;
    let html = clean`
      <div id="c" class="a b"></div>
    `;
    let document = parseHtml(html);
    let body = bodyElement(document)!;
    let cascade = new Cascade(css, document);
    return cascade.perform().then(cascadedStyles => {
      walkElements(body, (node) => {
        let elStyle = cascadedStyles.get(node);
        if (elStyle) {
          let styles = elStyle.compute();
          assert.deepEqual(styles, {
            "background-attachment": "scroll",
            "background-clip": "border-box",
            "background-color": "#F00",
            "background-image": "none",
            "background-origin": "padding-box",
            "background-position": "0% 0%",
            "background-repeat": "repeat",
            "background-size": "auto auto",
            "color": "red",
          });
        }
      });
    });
  }
}

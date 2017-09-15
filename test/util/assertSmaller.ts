import * as cssSize from "css-size";
import * as assert from "assert";
import { CascadeTestResult } from "./assertCascade";
import { inspect } from "util";

function assertDelta(cssDelta: cssSize.Result<number>, templateDelta: cssSize.Result<number>, type: keyof cssSize.Result<number>) {
    let delta = cssDelta[type].difference + templateDelta[type].difference;
    assert(delta > 0, `Expected ${type} size difference of CSS + Template to be smaller; was ${-delta} bytes bigger.
    CSS Delta:
    ${inspect(cssDelta)}
    Template Delta:
    ${inspect(templateDelta)}`);
}

export function assertSmaller(inputCSS: string, result: CascadeTestResult): Promise<void> {
  let testedMarkup = result.testedTemplates[0].testedMarkups[0];
  let inputHtml = testedMarkup.originalBody;
  let optimizedHtml = Promise.resolve({css: testedMarkup.optimizedBody});
  const optimizedCss = Promise.resolve({css: result.optimization.output.content.toString()});
  let templatePromise = cssSize.numeric(inputHtml, {}, () => optimizedHtml);
  let cssPromise = cssSize.numeric(inputCSS, {}, () => optimizedCss);
  return Promise.all([cssPromise, templatePromise]).then(([cssDelta, templateDelta]) => {
    assertDelta(cssDelta, templateDelta, "uncompressed");
    assertDelta(cssDelta, templateDelta, "gzip");
    assertDelta(cssDelta, templateDelta, "brotli");
  });
}

export function debugSize(inputCSS: string, result: CascadeTestResult): Promise<void> {
  let testedMarkup = result.testedTemplates[0].testedMarkups[0];
  let inputHtml = testedMarkup.originalBody;
  let optimizedHtml = Promise.resolve({css: testedMarkup.optimizedBody});
  const optimizedCss = Promise.resolve({css: result.optimization.output.content.toString()});
  let templatePromise = cssSize.table(inputHtml, {}, () => optimizedHtml).then((table) => {
    console.log("Markup");
    console.log(table);
  });
  let cssPromise = cssSize.table(inputCSS, {}, () => optimizedCss).then((table) => {
    console.log("Styles");
    console.log(table);
  });
  return Promise.all([cssPromise, templatePromise]).then(() => {});
}

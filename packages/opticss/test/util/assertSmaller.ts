import * as cssSize from "css-size";
import * as assert from "assert";
import { CascadeTestResult } from "./assertCascade";
import { inspect } from "util";
import { documentToString } from "resolve-cascade";

function assertDelta(type: keyof cssSize.Result<number>, cssDelta: cssSize.Result<number>, templateDelta: cssSize.Result<number>, assertions?: DeltaAssertions) {
    let delta = cssDelta[type].difference + templateDelta[type].difference;
    let originalTotal = (cssDelta[type].original + templateDelta[type].original);
    let processedTotal = (cssDelta[type].processed + templateDelta[type].processed);
    let fraction = (originalTotal - processedTotal) / originalTotal;
    let assertion: DeltaAssertion = assertions && assertions[type] || { atLeastSmallerThan: 1 };
    try {
      if (assertion.skip) {
        return;
      }
      if (assertion.notBiggerThan !== undefined) {
        if (assertion.notBiggerThan < 1) {
          assert(-fraction <= assertion.notBiggerThan, `Expected ${type} size ratio of CSS + Template to not be bigger than ${assertion.notBiggerThan}; was ${fraction*100}% bigger.`);
        } else {
          assert(-delta <= assertion.notBiggerThan , `Expected ${type} size difference of CSS + Template to not be bigger than ${assertion.notBiggerThan}; was ${-delta} bytes bigger.`);
        }
      } else if (assertion.atLeastSmallerThan !== undefined) {
        if (assertion.atLeastSmallerThan < 1) {
          assert(fraction >= assertion.atLeastSmallerThan, `Expected ${type} size ratio of CSS + Template to be smaller than ${assertion.atLeastSmallerThan}; was ${fraction*100}% smaller.`);
        } else {
          assert(delta >= assertion.atLeastSmallerThan , `Expected ${type} size difference of CSS + Template to be smaller than ${assertion.atLeastSmallerThan} bytes; was ${delta} bytes bigger.`);
        }
      }
    } catch (e) {
      e.message += "\nCSS Delta:\n" +
                   inspect(cssDelta) +
                   "\nTemplate Delta:\n" +
                   inspect(templateDelta);
      throw e;
    }
}

export interface DeltaAssertion {
  notBiggerThan?: number;
  atLeastSmallerThan?: number;
  skip?: boolean;
}

export interface DeltaAssertions {
  uncompressed?: DeltaAssertion;
  gzip?: DeltaAssertion;
  brotli?: DeltaAssertion;
}
export type SizeResultPair = [cssSize.Result<number>, cssSize.Result<number>];

export function assertSmaller(
  inputCSS: string,
  result: CascadeTestResult,
  assertions?: DeltaAssertions
): Promise<SizeResultPair> {
  let assertionResults = result.testedTemplates[0].assertionResults[0];
  return assertSmallerStylesAndMarkup(
    inputCSS,
    result.optimization.output.content.toString(),
    documentToString(assertionResults.expectedDoc),
    documentToString(assertionResults.actualDoc),
    assertions
  );
}

export function assertSmallerStylesAndMarkup(
  inputCSS: string,
  outputCSS: string,
  inputMarkup: string,
  outputMarkup: string,
  assertions?: DeltaAssertions
): Promise<SizeResultPair> {
  let optimizedHtml = Promise.resolve({css: outputMarkup});
  const optimizedCss = Promise.resolve({css: outputCSS});
  let templatePromise = cssSize.numeric(inputMarkup, {}, () => optimizedHtml);
  let cssPromise = cssSize.numeric(inputCSS, {}, () => optimizedCss);
  return Promise.all([cssPromise, templatePromise]).then(([cssDelta, templateDelta]) => {
    assertDelta("uncompressed", cssDelta, templateDelta, assertions);
    assertDelta("gzip", cssDelta, templateDelta, assertions);
    assertDelta("brotli", cssDelta, templateDelta, assertions);
    return <SizeResultPair>[cssDelta, templateDelta];
  });
}

export function debugSize(result: CascadeTestResult): Promise<void> {
  let results = result.testedTemplates[0].assertionResults[0];
  let inputHtml = documentToString(results.expectedDoc);
  let optimizedHtml = Promise.resolve({css: documentToString(results.actualDoc)});
  const optimizedCss = Promise.resolve({css: results.actualCss});
  let templatePromise = cssSize.table(inputHtml, {}, () => optimizedHtml).then((table) => {
    console.log("Markup");
    console.log(table);
  });
  let cssPromise = cssSize.table(results.expectedCss, {}, () => optimizedCss).then((table) => {
    console.log("Styles");
    console.log(table);
  });
  return Promise.all([cssPromise, templatePromise]).then(() => {});
}

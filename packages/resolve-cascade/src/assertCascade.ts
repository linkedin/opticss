/**
 * @module resolve-cascade
 **/
import * as assert from "assert";
import * as propParser from "css-property-parser";
import * as parse5 from "parse5";

import {
  Cascade,
  ComputedStyle,
  ElementStyle,
  FullCascade,
  allElements,
  bodyElement,
  debugElement,
  parseHtml,
} from "./index";

export interface AssertionResult {
  expectedFullCascade: FullCascade;
  expectedDoc: parse5.Document;
  expectedCss: string;
  actualFullCascade: FullCascade;
  actualDoc: parse5.Document;
  actualCss: string;
}

export class MarkupMismatchError extends assert.AssertionError {
  constructor(actual: string, expected: string, message: string) {
    super({message, actual, expected});
  }
}

export interface CascadeInformation {
  expectedHtml: string;
  actualHtml: string;
  expectedElement: string;
  actualElement: string;
  expectedCss: string;
  actualCss: string;
  expectedCascade: ElementStyle | undefined;
  actualCascade: ElementStyle | undefined;
  expectedStyles: ComputedStyle | undefined;
  actualStyles: ComputedStyle | undefined;
}

export class ElementStyleMismatch extends assert.AssertionError implements CascadeInformation {
  expectedHtml: string;
  actualHtml: string;
  expectedElement: string;
  actualElement: string;
  expectedCss: string;
  actualCss: string;
  expectedCascade: ElementStyle;
  actualCascade: ElementStyle;
  expectedStyles: ComputedStyle | undefined;
  actualStyles: ComputedStyle | undefined;
  constructor(details: CascadeInformation, message?: string) {
    super({
      expected: details.expectedStyles,
      actual: details.actualStyles,
      message: message || "Styles do not match.",
    });
    Object.assign(this, details);
  }
}

/**
 * This function makes sure two styles are functionally equivalent.
 * for the given css property.
 *
 * Currently this assures that initial values which can be different
 * but functionally equivalent, are treated as the same value.
 *
 * it also does a case insensitive value check and some whitespace
 * normalization.
 *
 * @param property The css property
 * @param actualValue a css value for the property
 * @param expectedValue a css value for the property
 */
export function assertSameStyle(
  property: string,
  actualValue: string,
  expectedValue: string,
) {
  try {
    if (propParser.isInitialValue(property, expectedValue)) {
      if (!propParser.isInitialValue(property, actualValue)) {
        assert.fail(`Expected ${actualValue} to be an initial value for ${property}.`);
      } else {
        return;
      }
    }
  } catch (e) {
    if (e instanceof propParser.UnknownPropertyError) {
      if (!e.property.startsWith("-")) {
        // tslint:disable-next-line:no-console
        console.log(e.message);
      }
    } else {
      throw e;
    }
  }
  expectedValue = expectedValue.toLowerCase().trim().replace(/\s+/g, " ");
  actualValue = actualValue.toLowerCase().trim().replace(/\s+/g, " ");
  assert.equal(actualValue, expectedValue);
}

export function assertSameCascade(
  expectedCss: string,
  actualCss: string,
  expectedHtml: string,
  actualHtml: string,

): Promise<AssertionResult> {
  let expectedDoc = parseHtml(expectedHtml);
  let expectedFullCascade = new Cascade(expectedCss, expectedDoc);

  let actualDoc = parseHtml(actualHtml);
  let actualFullCascade = new Cascade(actualCss, actualDoc);

  let cascades = [expectedFullCascade.perform(), actualFullCascade.perform()];
  return Promise.all(cascades).then(([expectedFullCascade, actualFullCascade]) => {
    let expectedBody = bodyElement(expectedDoc)!;
    let expectedElements = allElements(expectedBody);

    let actualBody = bodyElement(actualDoc)!;
    let actualElements = allElements(actualBody);

    if (actualElements.length !== expectedElements.length) {
      throw new MarkupMismatchError(
        expectedHtml,
        actualHtml,
        "html has differing element lengths",
      );
    }

    for (let i = 0; i < expectedElements.length; i++) {
      let expectedElement = expectedElements[i];
      let actualElement = actualElements[i];
      let expectedCascade = expectedFullCascade.get(expectedElement);
      let actualCascade = actualFullCascade.get(actualElement);
      if (expectedCascade || actualCascade) {
        // TODO: pseudoelement and pseudostate support
        let expectedStyles = expectedCascade && expectedCascade.compute();
        let actualStyles = actualCascade && actualCascade.compute();
        try {
          if (actualStyles && expectedStyles) {
            let actualProps = Object.keys(actualStyles).sort();
            let expectedProps = Object.keys(expectedStyles).sort();
            assert.deepEqual(actualProps, expectedProps);
            for (let prop of actualProps) {
              assertSameStyle(prop, actualStyles[prop], expectedStyles[prop]);
            }
          } else {
            if (actualStyles) {
              assert.fail("Styles were not expected for the element");
            }
            if (expectedStyles) {
              assert.fail("Expected styles were not assigned to the element");
            }
          }
        } catch (e) {
          throw new ElementStyleMismatch(
            {
              expectedHtml,
              actualHtml,
              expectedElement: debugElement(expectedElement),
              actualElement: debugElement(actualElement),
              expectedCss,
              actualCss,
              expectedCascade,
              actualCascade,
              expectedStyles,
              actualStyles,
            },
            e.message,
          );
        }
      }
    }
    return {
      expectedFullCascade,
      expectedDoc,
      expectedCss,
      actualFullCascade,
      actualDoc,
      actualCss,
    };
  });
}

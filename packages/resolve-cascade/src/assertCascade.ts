import * as assert from 'assert';
import * as parse5 from 'parse5';

import {
  allElements,
  bodyElement,
  Cascade,
  ComputedStyle,
  debugElement,
  ElementStyle,
  FullCascade,
  parseHtml,
} from './index';

export interface AssertionResult {
  expectedFullCascade: FullCascade;
  expectedDoc: parse5.AST.HtmlParser2.Document;
  expectedCss: string;
  actualFullCascade: FullCascade;
  actualDoc: parse5.AST.HtmlParser2.Document;
  actualCss: string;
}

export class MarkupMismatchError extends assert.AssertionError {
  constructor(actual: string, expected: string, message = "html has differing element lengths") {
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
  constructor(details: CascadeInformation) {
    super({
      expected: details.expectedStyles,
      actual: details.actualStyles,
      message: "Styles do not match."
    });
    Object.assign(this, details);
  }
}

export function assertSameCascade(
  expectedCss: string,
  actualCss: string,
  expectedHtml: string,
  actualHtml: string
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
      throw new MarkupMismatchError(expectedHtml, actualHtml);
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
          assert.deepEqual(actualStyles, expectedStyles);
        } catch (e) {
          throw new ElementStyleMismatch({
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
          });
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

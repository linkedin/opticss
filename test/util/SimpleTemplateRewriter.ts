import * as parse5 from "parse5";

import { TemplateAnalysis } from "../../src/TemplateAnalysis";
import { allElements, bodyContents, bodyElement } from "./SimpleTemplateRunner";
import { StyleMapping, RewriteMapping, AndExpression, OrExpression, NotExpression } from "../../src/StyleMapping";
import { AttributeValueParser } from "./AttributeValueParser";
import { Tagname, Element, Attr, AttributeNS, Attribute } from "../../src/Selectable";
import { POSITION_UNKNOWN } from "../../src/SourceLocation";
import { BooleanExpression } from "../../src/index";
import assertNever from "../../src/util/assertNever";
import { TestTemplate } from "./TestTemplate";

export class SimpleTemplateRewriter {
  styleMapping: StyleMapping;

  constructor(styleMapping: StyleMapping) {
    this.styleMapping = styleMapping;
  }

  rewrite(template: TestTemplate, html: string) {
    let valueParser = new AttributeValueParser(template.plainHtml);
    let templateDoc = parse5.parse(template.contents, {
      treeAdapter: parse5.treeAdapters.default
    }) as parse5.AST.Default.Document;
    let document = parse5.parse(html, {
      treeAdapter: parse5.treeAdapters.default
    }) as parse5.AST.Default.Document;

    let templateElements = allElements(bodyElement(templateDoc)!);
    let htmlElements = allElements(bodyElement(document)!);
    if (templateElements.length !== htmlElements.length) {
      throw new Error("template and html don't match");
    }
    for (let i = 0; i < templateElements.length; i++) {
      let templateElement = templateElements[i];
      let element = htmlElements[i];
      let tagname = new Tagname({constant: templateElement.tagName});
      let attrs: Array<Attr> = templateElement.attrs.map(attr => {
        let value = valueParser.parse(attr.namespace, attr.name, attr.value);
        if (attr.namespace) {
          return new AttributeNS(attr.namespace, attr.name, value);
        } else {
          return new Attribute(attr.name, value);
        }
      });
      let elementInfo = new Element(tagname, attrs);
      element.attrs.forEach(attr => {
        if (attr.name === "class") {
          return;
        }
        let toAttr = this.styleMapping.getRewriteOf(attr);
        if (toAttr) {
          if (attr.name === toAttr.name) {
            attr.value = toAttr.value;
          } else {
            throw new Error("cannot rewrite to different attribute at this time");
          }
        }
      });
      let classMapping = this.styleMapping.classMapping(elementInfo);
      if (classMapping) {
        let classAttr = element.attrs.find(a => isClassAttr(a));
        let presentClassnames = new Set(classAttr ? classAttr.value.split(/\s+/) : []);
        let classValue = classMapping.staticClasses.slice();
        let dynamicClassNames = Object.keys(classMapping.dynamicClasses);
        dynamicClassNames.forEach(dcn => {
          let expression = classMapping!.dynamicClasses[dcn];
          if (evaluateExpression(expression, classMapping!, element, presentClassnames)) {
            classValue.push(dcn);
          }
        });
        if (classAttr) {
          if (classValue.length === 0) {
            element.attrs = element.attrs.reduce((m,a) => {
              if (!isClassAttr(a)) {
                m.push(a);
              }
              return m;
            }, new Array<parse5.AST.Default.Attribute>());
          } else {
            classAttr.value = classValue.join(" ");
          }
        } else {
          if (classValue.length > 0) {
            element.attrs.push({
              name: "class",
              value: classValue.join(" ")
            });
          }
        }
      }
    }
    return bodyContents(document);
  }
}

function evaluateExpression(
  expression: BooleanExpression<number>,
  classMapping: RewriteMapping,
  element: parse5.AST.Default.Element,
  presentClassnames: Set<string>
): boolean {
  if (isAndExpression(expression)) {
    return expression.and.every(e => {
      if (typeof e === "number") {
        let classname = classMapping.inputClassnames[e];
        return presentClassnames.has(classname);
      } else {
        return evaluateExpression(e, classMapping, element, presentClassnames);
      }
    });
  } else if (isOrExpression(expression)) {
    return expression.or.some(e => {
      if (typeof e === "number") {
        let classname = classMapping.inputClassnames[e];
        return presentClassnames.has(classname);
      } else {
        return evaluateExpression(e, classMapping, element, presentClassnames);
      }
    });
  } else if (isNotExpression(expression)) {
    let e = expression.not;
    if (typeof e === "number") {
      let classname = classMapping.inputClassnames[e];
      return !presentClassnames.has(classname);
    } else {
      return evaluateExpression(e, classMapping, element, presentClassnames);
    }
  } else {
    return assertNever(expression);
  }
}

function isClassAttr(attr: parse5.AST.Default.Attribute): boolean {
  return attr.namespace === undefined && attr.name === "class";
}

function isWhitespaceAttr(attr: parse5.AST.Default.Attribute): boolean {
  return isClassAttr(attr);
}

function isAndExpression<T>(expression: BooleanExpression<T>): expression is AndExpression<T> {
  return !!((<AndExpression<T>>expression).and);
}

function isOrExpression<T>(expression: BooleanExpression<T>): expression is OrExpression<T> {
  return !!((<OrExpression<T>>expression).or);
}

function isNotExpression<T>(expression: BooleanExpression<T>): expression is NotExpression<T> {
  return !!((<NotExpression<T>>expression).not);
}
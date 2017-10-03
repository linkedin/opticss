import * as parse5 from "parse5";
import { TemplateIntegrationOptions, Tagname, Element, Attr, AttributeNS, Attribute, StyleMapping, RewriteMapping, BooleanExpression, AndExpression, OrExpression, NotExpression, RewriteableAttrName, SimpleAttribute, SimpleTagname, isSimpleTagname } from "@opticss/template-api";
import { assertNever } from "@opticss/util";
import { allElements, bodyContents, bodyElement } from "./SimpleTemplateRunner";
import { AttributeValueParser } from "./AttributeValueParser";
import { TestTemplate } from "./TestTemplate";

export class SimpleTemplateRewriter {
  templateOptions: TemplateIntegrationOptions;
  styleMapping: StyleMapping;

  constructor(styleMapping: StyleMapping, templateOptions: TemplateIntegrationOptions) {
    this.styleMapping = styleMapping;
    this.templateOptions = templateOptions;
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
      let rewriteMapping = this.styleMapping.rewriteMapping(elementInfo);
      if (rewriteMapping) {
        let inputAttrs = element.attrs.slice();
        let rewriteAttributes = Object.keys(this.templateOptions.rewriteIdents);
        for (let rewriteAttr of rewriteAttributes) {
          if (this.templateOptions.rewriteIdents[rewriteAttr]) {
            this.rewriteAttribute(<RewriteableAttrName>rewriteAttr, rewriteMapping, element, inputAttrs);
          }
        }
      }
    }
    return bodyContents(document);
  }
  rewriteAttribute(
    name: RewriteableAttrName,
    rewriteMapping: RewriteMapping,
    element: parse5.AST.Default.Element,
    inputAttrs: Array<parse5.AST.Default.Attribute>,
  ) {
    let attrIndex = element.attrs.findIndex(a => a.name === name);
    let attr = attrIndex >= 0 ? element.attrs[attrIndex] : undefined;
    let rewrittenValue = rewriteMapping.staticAttributes[name]!.slice();
    let dynamicExpressions = Object.keys(rewriteMapping.dynamicAttributes[name]!);
    for (let dyn of dynamicExpressions) {
      let expression = rewriteMapping!.dynamicAttributes[name]![dyn]!;
      if (evaluateExpression(expression, rewriteMapping!, element, inputAttrs)) {
        rewrittenValue.push(dyn);
      }
    }
    if (rewrittenValue.length > 1 && name !== "class") {
      throw new Error("Invalid analysis or internal error: " +
        "multiple values returned for non-whitespace delimited attribute");
    }
    if (attr) {
      if (rewrittenValue.length === 0) {
        element.attrs.splice(attrIndex, 1);
      } else {
        attr.value = rewrittenValue.join(" ");
      }
    } else {
      if (rewrittenValue.length > 0) {
        element.attrs.push({ name, value: rewrittenValue.join(" ") });
      }
    }
  }
}

function elementHas(
  element: parse5.AST.Default.Element,
  trait: SimpleTagname | SimpleAttribute,
  inputAttrs: Array<parse5.AST.Default.Attribute>,
): boolean {
  if (isSimpleTagname(trait)) {
    return element.tagName === trait.tagname;
  } else {
    let attr = trait;
    let elAttr = inputAttrs.find((a) => attr.name === a.name);
    if (!elAttr) return false;
    if (attr.name === "class") {
      return attr.value && elAttr.value.split(/\s+/).includes(attr.value) || false;
    } else {
      return attr.value === elAttr.value;
    }
  }
}

function evaluateExpression(
  expression: BooleanExpression<number>,
  classMapping: RewriteMapping,
  element: parse5.AST.Default.Element,
  inputAttrs: Array<parse5.AST.Default.Attribute>,
): boolean {
  if (isAndExpression(expression)) {
    return expression.and.every(e => {
      if (typeof e === "number") {
        let attr = classMapping.inputs[e];
        return elementHas(element, attr, inputAttrs);
      } else {
        return evaluateExpression(e, classMapping, element, inputAttrs);
      }
    });
  } else if (isOrExpression(expression)) {
    return expression.or.some(e => {
      if (typeof e === "number") {
        let attr = classMapping.inputs[e];
        return elementHas(element, attr, inputAttrs);
      } else {
        return evaluateExpression(e, classMapping, element, inputAttrs);
      }
    });
  } else if (isNotExpression(expression)) {
    let e = expression.not;
    if (typeof e === "number") {
      let attr = classMapping.inputs[e];
      return !elementHas(element, attr, inputAttrs);
    } else {
      return evaluateExpression(e, classMapping, element, inputAttrs);
    }
  } else {
    return assertNever(expression);
  }
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
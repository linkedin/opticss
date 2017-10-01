import { AttributeValue } from "@opticss/template-api";
import * as nearley from "nearley";
const grammar = require("./grammar/attrvalue");

export class AttributeValueParser {
  plainHtml: boolean;
  constructor(plainHtml: boolean) {
    // support for normal html instead of dynamic attribute expressions.
    this.plainHtml = plainHtml;
  }
  parse(attrNamespace: string | null | undefined, attrName: string, value: string): AttributeValue {
    let whitespaceDelimited = attrName === "class" && !attrNamespace;
    if (attrName.match(/^on/) || value.startsWith("javascript:")) { // it's script -- ignore
      return {absent: true};
    } else if (isTextAttribute(attrNamespace, attrName, value)) { // it's text. return constant.
      return {constant: value};
    }
    if (!whitespaceDelimited && this.plainHtml) {
      return {constant: value};
    }
    let startProduction = whitespaceDelimited ? "whitespaceDelimitedAttribute" : "attribute";
    let grammarObj = nearley.Grammar.fromCompiled(<any>grammar);
    (<any>grammarObj).start = startProduction; // because this api is stupid.
    let parser = new nearley.Parser(grammarObj);
    parser.feed(value);
    let res = parser.finish();
    return res[0];
  }
}

function isTextAttribute(_attrNamespace: string | null | undefined, attrName: string, _value: string): boolean {
  return ["title", "media", "content", "style"].indexOf(attrName) !== -1;
}
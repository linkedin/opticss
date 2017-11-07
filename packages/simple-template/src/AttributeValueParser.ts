import { AttributeValue } from "@opticss/template-api";
import * as nearley from "nearley";
const grammar = require("./grammar/attrvalue");

// All attributes that are considered plaintext and cannot contain expressions.
const TEXT_ATTRIBUTES = {
  "title": 1, "media": 1, "content": 1, "style": 1
};

export class AttributeValueParser {
  plainHtml: boolean;
  constructor(plainHtml: boolean) {
    // support for normal html instead of dynamic attribute expressions.
    this.plainHtml = plainHtml;
  }
  parse(attrNamespace: string | null | undefined, attrName: string, value: string): AttributeValue {

    // Attributes are whitespace delimited if they are `class` attributes with now namespace.
    let whitespaceDelimited = attrName === "class" && !attrNamespace;

    // If whitespace delimited, be sure to trim unused whitespace.
    if (whitespaceDelimited) {
      value = value.trim();
    }

    // If begins with `javascript:`, or is an `onEvent` attr, it's script -- ignore
    if ( attrName.match(/^on/) || value.startsWith("javascript:") ) {
      return { absent: true };
    }

    // If it's a plain text attribute, or is a non-whitespace delimited attr in
    // an HTML document, return the constant value.
    if ( TEXT_ATTRIBUTES[attrName] || (!whitespaceDelimited && this.plainHtml) ) {
      return { constant: value };
    }

    // Parse the grammar, return AttributeValue object.
    let grammarObj = nearley.Grammar.fromCompiled(<any>grammar);
    (<any>grammarObj).start = whitespaceDelimited ? "whitespaceDelimitedAttribute" : "attribute"; // because this api is stupid.
    let parser = new nearley.Parser(grammarObj);
    parser.feed(value);
    let res = parser.finish();
    return res[0];
  }
}

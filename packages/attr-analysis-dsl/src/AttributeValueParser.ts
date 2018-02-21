import { AttributeValue } from "@opticss/element-analysis";
import * as nearley from "nearley";
const grammar: nearley.CompiledRules = require("./grammar/attrvalue");

export interface AttributeFlags {
  [attrName: string]: boolean;
}

const WHITESPACE_ATTRIBUTES: AttributeFlags = {
  "class": true,
};

// All attributes that are considered plaintext and cannot contain expressions.
const TEXT_ATTRIBUTES: AttributeFlags = {
  "title": true, "media": true, "content": true, "style": true,
};

export class AttributeValueParser {
  whitespaceAttributes: AttributeFlags;
  textAttributes: AttributeFlags;
  plainHtml: boolean;
  constructor(plainHtml = false, textAttributes: AttributeFlags = {}, whitespaceAttributes: AttributeFlags = {}) {
    this.textAttributes = {...TEXT_ATTRIBUTES, ...textAttributes};
    this.whitespaceAttributes = {...WHITESPACE_ATTRIBUTES, ...whitespaceAttributes};
    // support for normal html instead of dynamic attribute expressions.
    this.plainHtml = plainHtml;
  }
  parse(attrNamespace: string | null | undefined, attrName: string, value: string): AttributeValue {

    // Attributes are whitespace delimited if they are `class` attributes with now namespace.
    let attrKey = attrName;
    if (attrNamespace) attrKey = `${attrNamespace}:${attrKey}`;
    let whitespaceDelimited = this.whitespaceAttributes[attrKey];

    // If whitespace delimited, be sure to trim unused whitespace.
    if (whitespaceDelimited) {
      value = value.trim();
    }

    // If begins with `javascript:`, or is an `onEvent` attr, it's script -- ignore
    if (attrName.match(/^on/) || value.startsWith("javascript:")) {
      return { absent: true };
    }

    // If it's a plain text attribute, or is a non-whitespace delimited attr in
    // an HTML document, return the constant value.
    if (this.textAttributes[attrKey] || (!whitespaceDelimited && this.plainHtml)) {
      return { constant: value };
    }

    // Parse the grammar, return AttributeValue object.
    let grammarObj = nearley.Grammar.fromCompiled(grammar);
    grammarObj.start = whitespaceDelimited ? "whitespaceDelimitedAttribute" : "attribute"; // because this api is stupid.
    let parser = new nearley.Parser(grammarObj);
    parser.feed(value);
    let res = parser.finish();
    return res[0];
  }
}

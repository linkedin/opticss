import { AttributeValue } from "../../src/Selectable";
import * as nearley from "nearley";
const grammar = require("./attrvalue");

export class AttributeValueParser {
  parse(value: string, whitespaceDelimited: boolean): AttributeValue {
    let startProduction = whitespaceDelimited ? "whitespaceDelimitedAttribute" : "attribute";
    let grammarObj = nearley.Grammar.fromCompiled(<any>grammar, startProduction);
    (<any>grammarObj).start = startProduction; // because this api is stupid.
    let parser = new nearley.Parser(grammarObj);
    parser.feed(value);
    let res = parser.finish();
    return res[0];
  }
}
import { AttributeValue } from "../../src/Styleable";
import * as nearley from "nearley";
const grammar = require("./attrvalue");

export class AttributeValueParser {
  parse(value: string): AttributeValue {
    let parser = new nearley.Parser(nearley.Grammar.fromCompiled(<any>grammar, "main"));
    parser.feed(value);
    let res = parser.finish();
    return res[0];
  }
}
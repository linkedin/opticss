import { Template, TemplateTypes, TemplateInfo } from "../../src/TemplateInfo";
import { TemplateAnalysis, POSITION_UNKNOWN } from "../../src/TemplateAnalysis";
import * as cheerio from "cheerio";
import { Tagname, Attribute, AttributeValue } from "../../src/Styleable";
import { AttributeValueParser } from "./AttributeValueParser";

export class SimpleAnalyzer<K extends keyof TemplateTypes> {
  template: TemplateInfo<K>;
  contents: string;
  includeSourceInformation: boolean;
  valueParser: AttributeValueParser;
  constructor(template: TemplateInfo<K>, contents: string, includeSourceInformation = false) {
    this.template = template;
    this.contents = contents;
    this.includeSourceInformation = includeSourceInformation;
    this.valueParser = new AttributeValueParser();
  }
  private attrValue(valueStr: string, whitespaceDelimited = false): AttributeValue {
    return this.valueParser.parse(valueStr, whitespaceDelimited);
  }
  analyze(): TemplateAnalysis<K> {
    let analysis = new TemplateAnalysis<K>(this.template);
    let $ = cheerio.load(this.contents);
    $("*").each((i, el) => {
      analysis.startElement(new Tagname({constant: el.name}), this.includeSourceInformation ? {line: i + 1} : POSITION_UNKNOWN);
      let attrs = Object.keys(el.attribs);
      attrs.forEach(attr => {
        analysis.addAttribute(new Attribute(attr, this.attrValue(el.attribs[attr], attr === "class")));
      });
      analysis.endElement();
    });
    return analysis;
  }
}
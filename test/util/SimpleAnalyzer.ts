import { Template, TemplateTypes, TemplateInfo } from "../../src/TemplateInfo";
import { TemplateAnalysis, POSITION_UNKNOWN } from "../../src/TemplateAnalysis";
import { Tagname, Attribute, AttributeValue } from "../../src/Styleable";
import { AttributeValueParser } from "./AttributeValueParser";
import { TestTemplate } from "./TestTemplate";

export class SimpleAnalyzer {
  template: TestTemplate;
  includeSourceInformation: boolean;
  valueParser: AttributeValueParser;
  idMap: WeakMap<CheerioElement, string>;
  constructor(template: TestTemplate, includeSourceInformation = false) {
    this.template = template;
    this.includeSourceInformation = includeSourceInformation;
    this.valueParser = new AttributeValueParser();
    this.idMap = new WeakMap();
  }
  private attrValue(valueStr: string, whitespaceDelimited = false): AttributeValue {
    return this.valueParser.parse(valueStr, whitespaceDelimited);
  }
  analyze(): TemplateAnalysis<"TestTemplate"> {
    let nextId = 1;
    let analysis = new TemplateAnalysis<"TestTemplate">(this.template);
    this.template.ast("*").each((i, el) => {
      analysis.startElement(new Tagname({constant: el.name}), this.includeSourceInformation ? {line: i + 1} : POSITION_UNKNOWN);
      let id = (nextId++).toString();
      this.idMap.set(el, id);
      analysis.setId(id);
      let attrs = Object.keys(el.attribs);
      attrs.forEach(attr => {
        analysis.addAttribute(new Attribute(attr, this.attrValue(el.attribs[attr], attr === "class")));
      });
      analysis.endElement();
    });
    return analysis;
  }
}
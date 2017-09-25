import * as parse5 from "parse5";
import { TemplateAnalysis } from "../../src/TemplateAnalysis";
import { Tagname, Attribute, AttributeValue, AttributeNS } from "../../src/Selectable";
import { AttributeValueParser } from "./AttributeValueParser";
import { TestTemplate } from "./TestTemplate";
import { POSITION_UNKNOWN } from "../../src/SourceLocation";

export interface HasAnalysisId {
  analysisId: string;
}

export class SimpleAnalyzer {
  template: TestTemplate;
  includeSourceInformation: boolean;
  valueParser: AttributeValueParser;
  /**
   * Creates an instance of SimpleAnalyzer.
   * @param template The template to be analyzed.
   * @param [includeSourceInformation=false] Whether to record source positions
   *   for elements in the analysis.
   */
  constructor(template: TestTemplate, includeSourceInformation = false) {
    this.template = template;
    this.includeSourceInformation = includeSourceInformation;
    this.valueParser = new AttributeValueParser(template.plainHtml);
  }
  private attrValue(attrNamespace: string | null | undefined, attrName: string, valueStr: string): AttributeValue {
    return this.valueParser.parse(attrNamespace, attrName, valueStr);
  }
  analyze(): Promise<TemplateAnalysis<"TestTemplate">> {
    let analysis = new TemplateAnalysis<"TestTemplate">(this.template);
    const parser = new parse5.SAXParser({ locationInfo: this.includeSourceInformation });
    parser.on("startTag", (name, attrs, _selfClosing, location) => {
      let startLocation = location ? {line: location.line, column: location.col} : POSITION_UNKNOWN;
      let endLocation = location ? {line: location.line, column: location.col + location.endOffset} : POSITION_UNKNOWN;
      analysis.startElement(new Tagname({constant: name}), startLocation);
      attrs.forEach(attr => {
        if (attr.namespace) {
          analysis.addAttribute(new AttributeNS(attr.namespace, attr.name, this.attrValue(attr.namespace, attr.name, attr.value)));
        } else {
          analysis.addAttribute(new Attribute(attr.name, this.attrValue(attr.namespace, attr.name, attr.value)));
        }
      });
      analysis.endElement(endLocation);
    });
    return new Promise((resolve, reject) => {
      parser.write(this.template.contents, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(analysis);
        }
      });
    });
  }
}
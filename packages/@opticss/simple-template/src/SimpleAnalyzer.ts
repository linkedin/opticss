import { AttributeValueParser } from "@opticss/attr-analysis-dsl";
import { Attribute, AttributeNS, POSITION_UNKNOWN, Tagname  } from "@opticss/element-analysis";
import { TemplateAnalysis } from "@opticss/template-api";
import { whatever } from "@opticss/util";
import * as parse5 from "parse5";

import { TestTemplate } from "./TestTemplate";

export class SimpleAnalyzer {
  template: TestTemplate;
  includeSourceInformation: boolean;
  private valueParser: AttributeValueParser;

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

  /**
   * Analyze the TestTemplate.
   * @returns A promise that resolves with the analysis object after parsing.
   */
  analyze(): Promise<TemplateAnalysis<"TestTemplate">> {
    let analysis = new TemplateAnalysis<"TestTemplate">(this.template);
    const parser = new parse5.SAXParser({ locationInfo: this.includeSourceInformation });

    // On every element start tag, parse all attributes and add to the analysis.
    parser.on("startTag", (name, attrs, _selfClosing, location) => {
      let startLocation = location ? { line: location.line, column: location.col } : POSITION_UNKNOWN;
      let endLocation = location ? { line: location.line, column: location.col + location.endOffset } : POSITION_UNKNOWN;
      analysis.startElement(new Tagname({constant: name}), startLocation);
      attrs.forEach(attr => {
        let attrValue = this.valueParser.parse(attr.namespace, attr.name, attr.value);
        if (attr.namespace) {
          analysis.addAttribute(new AttributeNS(attr.namespace, attr.name, attrValue));
        } else {
          analysis.addAttribute(new Attribute(attr.name, attrValue));
        }
      });
      analysis.endElement(endLocation);
    });

    // Return a promise that resolves with the analysis object after parsing and analysis.
    return new Promise((resolve, reject) => {
      parser.write(this.template.contents, (err: whatever) => {
        if (err) { reject(err); }
        else     { resolve(analysis); }
      });
    });
  }
}

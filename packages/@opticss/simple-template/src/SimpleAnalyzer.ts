import { AttributeValueParser } from "@opticss/attr-analysis-dsl";
import { Attribute, AttributeNS, POSITION_UNKNOWN, Tagname  } from "@opticss/element-analysis";
import { TemplateAnalysis } from "@opticss/template-api";
import * as parse5 from "parse5-sax-parser";

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

    // @ts-ignore
    // Typescript doesn't like considering the default export a constructor...
    const parser = new parse5({ sourceCodeLocationInfo: this.includeSourceInformation });

    // On every element start tag, parse all attributes and add to the analysis.
    parser.on("startTag", (token: parse5.StartTagToken) => {
      let { tagName, attrs, sourceCodeLocation: location } = token;
      let startLocation = location ? { line: location.startLine, column: location.startCol } : POSITION_UNKNOWN;
      let endLocation = location ? { line: location.startLine, column: location.startCol + location.endOffset } : POSITION_UNKNOWN;
      analysis.startElement(new Tagname({constant: tagName}), startLocation);
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
      parser.write(this.template.contents, (err: unknown) => {
        if (err) { reject(err); }
        else     { resolve(analysis); }
      });
    });
  }
}

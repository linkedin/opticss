import * as cheerio from "cheerio";
import { TemplateTypes, TemplateInfo, SerializedTemplateInfo, TemplateInfoFactory } from "../../src/TemplateInfo";

declare module "../../src/TemplateInfo" {
  export interface TemplateTypes {
    "TestTemplate": TestTemplate;
  }
}

export class TestTemplate implements TemplateInfo<"TestTemplate"> {
  type: "TestTemplate";
  identifier: string;
  contents: string;
  _ast?: CheerioStatic;
  constructor(identifier: string, contents: string) {
    this.type = "TestTemplate";
    this.identifier = identifier;
    this.contents = contents;
  }

  get ast(): CheerioStatic & CheerioSelector {
    if (this._ast === undefined) {
      this._ast = cheerio.load(this.contents);
    }
    return this._ast;
  }

  static deserialize(identifier: string, ...data: any[]): TestTemplate {
    return new TestTemplate(identifier, data[0]);
  }
  serialize(): SerializedTemplateInfo<"TestTemplate"> {
    return {
      type: "TestTemplate",
      identifier: this.identifier,
      data: [
        this.contents
      ]
    };
  }
}
TemplateInfoFactory.constructors["TestTemplate"] = TestTemplate.deserialize;
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
  plainHtml: boolean;
  constructor(identifier: string, contents: string, plainHtml?: boolean) {
    this.type = "TestTemplate";
    this.identifier = identifier;
    this.contents = contents;
    this.plainHtml = !!plainHtml;
  }

  static deserialize(identifier: string, ...data: any[]): TestTemplate {
    return new TestTemplate(identifier, data[0], data[1] === "true");
  }
  serialize(): SerializedTemplateInfo<"TestTemplate"> {
    return {
      type: "TestTemplate",
      identifier: this.identifier,
      data: [
        this.contents,
        this.plainHtml ? "true" : "false"
      ]
    };
  }
}
TemplateInfoFactory.constructors["TestTemplate"] = TestTemplate.deserialize;
import {
  SerializedTemplateInfo,
  TemplateInfo,
  TemplateInfoFactory,
} from "@opticss/template-api";

declare module "@opticss/template-api" {
  export interface TemplateTypes {
    "TestTemplate": TestTemplate;
  }
}

/**
 * Represents a single TestTemplate and its associated content and meta data.
 */
export class TestTemplate implements TemplateInfo<"TestTemplate"> {
  type: "TestTemplate";
  identifier: string;
  contents: string;
  plainHtml: boolean;

  /**
   * Creates an instance of TestTemplate.
   * @param identifier Unique identifier for this template. Typically a filepath.
   * @param contents The string contents of this template file.
   * @param plainHtml Boolean, if this file is plain HTML, or contains dynamic attributes.
   */
  constructor(identifier: string, contents: string, plainHtml?: boolean) {
    this.type = "TestTemplate";
    this.identifier = identifier;
    this.contents = contents;
    this.plainHtml = !!plainHtml;
  }

  static deserialize(identifier: string, ...data: string[]): TestTemplate {
    return new TestTemplate(identifier, data[0], data[1] === "true");
  }

  serialize(): SerializedTemplateInfo<"TestTemplate"> {
    return {
      type: "TestTemplate",
      identifier: this.identifier,
      data: [
        this.contents,
        this.plainHtml ? "true" : "false",
      ],
    };
  }
}

// Register this template type on our TemplateFactory.
TemplateInfoFactory.constructors["TestTemplate"] = TestTemplate.deserialize;

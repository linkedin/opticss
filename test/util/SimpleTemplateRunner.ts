import { SimpleAnalyzer } from "./SimpleAnalyzer";
import { TestTemplate } from "./TestTemplate";

export class SimpleTemplateRunner {
  template: TestTemplate;
  initialize(template: TestTemplate) {
    this.template = template;
  }
  runOnce(): string {
    return "";
  }
  runAll(): string[] {
    return [""];
  }
  runSample(amount: number): string[] {
    if (amount < 1 && amount > 0) {
      // percentage
      return [""];
    } else {
      // absolute number
      return [""];
    }
  }
}
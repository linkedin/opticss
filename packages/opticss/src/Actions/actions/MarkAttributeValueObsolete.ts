import {
  SourcePosition,
} from "@opticss/element-analysis";
import {
  SimpleAttribute,
  simpleAttributeToString,
} from "@opticss/template-api";

import { OptimizationPass } from "../../OptimizationPass";
import { Optimizations } from "../../optimizations";
import { ParsedSelectorAndRule } from "../../query";
import { MultiAction } from "../Action";

/**
 * Note that an attribute value is not used and will be removed from the
 * template.
 */
export class MarkAttributeValueObsolete extends MultiAction {
  reason: string;
  pass: OptimizationPass;
  selectors: ParsedSelectorAndRule[];
  attribute: SimpleAttribute;

  constructor(
    pass: OptimizationPass,
    selectors: ParsedSelectorAndRule[],
    attribute: SimpleAttribute,
    reason: string,
    optimization: keyof Optimizations = "mergeDeclarations",
  ) {
    super(optimization);
    this.pass = pass;
    this.selectors = selectors;
    this.attribute = attribute;
    this.reason = reason;
  }
  get sourcePosition(): SourcePosition | undefined {
    if (this.selectors.length > 0 && this.selectors[0].rule.source && this.selectors[0].rule.source.start) {
      return this.selectors[0].rule.source.start;
    } else {
      return undefined;
    }
  }
  perform(): this {
    this.pass.styleMapping.attributeIsObsolete(this.attribute);
    return this;
  }

  logStrings(): Array<string> {
    let logs = new Array<string>();
    let mainMessage = `Attribute ${simpleAttributeToString(this.attribute)} will be removed from templates. ${this.reason}`;
    let firstPos = this.nodeSourcePosition(this.selectors[0].rule);
    if (firstPos) { firstPos.line = -1; }
    logs.push(this.annotateLogMessage(mainMessage, firstPos));
    for (let sel of this.selectors) {
      let rulePos = this.nodeSourcePosition(sel.rule);
      let msg = `Was used in selector: ${sel.parsedSelector}`;
      logs.push(this.annotateLogMessage(msg, rulePos, 1));
    }
    return logs;
  }
}

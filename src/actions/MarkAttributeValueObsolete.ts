import {
  OptimizationPass,
} from '../OptimizationPass';
import {
  Optimizations,
} from '../optimizations';
import {
  ParsedSelectorAndRule,
} from '../query';
import {
  SourcePosition,
} from '../SourceLocation';
import {
  SimpleAttribute,
  simpleAttributeToString,
} from '../StyleMapping';
import {
  MultiAction,
} from './Action';

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
    optimization: keyof Optimizations = "mergeDeclarations"
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
    logs.push(this.annotateLogMessage(mainMessage, null));
    for (let sel of this.selectors) {
      let msg = `Was used in selector: ${sel.parsedSelector}`;
      logs.push(this.annotateLogMessage(msg, this.nodeSourcePosition(sel.rule), 1));
    }
    return logs;
  }
}
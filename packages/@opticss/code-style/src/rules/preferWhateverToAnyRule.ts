import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
  public apply(_sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    throw new Error("prefer-whatever-to-any has been replaced by prefer-unknown-to-any. Please update your configuration.");
  }
}

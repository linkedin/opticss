import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(new PreferUnknownToAny(sourceFile, this.getOptions()));
  }
}

// The walker takes care of all the work.
class PreferUnknownToAny extends Lint.RuleWalker {
  visitAnyKeyword(node: ts.Node): void {
    let fix = this.createReplacement(node.getStart(), 3, "unknown");
    this.addFailureAtNode(node, "Using `any` is usually a bad idea. Consider using `unknown` instead.", fix);
  }
}

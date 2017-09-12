import * as postcss from "postcss";
import { inspect } from "util";

export type RuleScope = Array<postcss.AtRule>;
export type RuleIteratorWithScope = (rule: postcss.Rule, scope: RuleScope) => false | undefined | void;

export function walkRules(container: postcss.Container, eachRule: RuleIteratorWithScope): void {
  _walkRulesWithScope(container, eachRule, []);
}

function _walkRulesWithScope(container: postcss.Container, eachRule: RuleIteratorWithScope, scope: RuleScope) {
  container.each(node => {
    if (isRule(node)) {
      eachRule(node, scope);
    } else if (isAtRule(node)) {
      if (node.name.includes("keyframes")) {
        // skip it, keyframe stops aren't optimizable.
      } else {
        _walkRulesWithScope(node, eachRule, scope.concat(node));
      }
    } else if (isContainer(node)) {
      console.log("warning: container that's not an AtRule encountered: " + inspect(node));
      _walkRulesWithScope(node, eachRule, scope);
    }
  });
}

function isAtRule(node: postcss.Node): node is postcss.AtRule {
  return (node.type === "atrule");
}

function isRule(node: postcss.Node): node is postcss.Rule {
  return (node.type === "rule");
}

function isContainer(node: postcss.Node): node is postcss.Container {
  return (<postcss.Container>node).each !== undefined;
}
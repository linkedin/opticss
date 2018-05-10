import { isObject, whatever } from "../../../@opticss/util/src";
import * as postcss from "postcss";
import * as selectorParser from "postcss-selector-parser";
import { isClassName, isIdentifier } from "postcss-selector-parser";
import { inspect } from "util";

import { ParsedCssFile } from "../CssFile";
import { ParsedSelector } from "../parseSelector";
import { SelectorCache } from "../query";

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
      if (node.name.includes("keyframes") || node.name.includes("font-face")) {
        // skip it, keyframe and font-face at-rules aren't optimizable.
      } else {
        _walkRulesWithScope(node, eachRule, scope.concat(node));
      }
    } else if (isContainer(node)) {
      // tslint:disable-next-line:no-console
      console.log("warning: container that's not an AtRule encountered: " + inspect(node));
      _walkRulesWithScope(node, eachRule, scope);
    }
  });
}

export interface IdentTypes {
  id?: boolean;
  class?: boolean;
}

export type IdentNode = selectorParser.Identifier | selectorParser.ClassName;

/**
 * Iterate over all identifiers (ex: .class and #id) in a given selector.
 * @param sel ParsedSelector to walk.
 * @param idents Object of type IdentTypes to indicate idents to traverse over.
 * @param cb Callback function passed the IdentNode.
 */
export function eachSelectorIdent(sel: ParsedSelector, idents: IdentTypes, cb: (node: IdentNode) => void) {
  sel.eachSelectorNode((node) => {
    if (idents.id && isIdentifier(node)) { cb(node); }
    else if (idents.class && isClassName(node)) { cb(node); }
  });
}

/**
 * Iterate over all identifiers (ex: .class and #id) in a given postcss tree.
 * @param root Postcss root to walk.
 * @param cache SelectorCache to ensure we are working with the same selector instances.
 * @param idents Object of type IdentTypes to indicate idents to traverse over.
 * @param cb Callback function passed the identifier, rule and parsed selector.
 */
export function eachIdent(root: postcss.Root, cache: SelectorCache, idents: IdentTypes, cb: (node: IdentNode, rule: postcss.Rule, sel: ParsedSelector) => void) {
  eachSelector(root, cache, (rule, sel) => eachSelectorIdent(sel, idents, (node) => cb(node, rule, sel)));
}

/**
 * Iterate over all identifiers (ex: .class and #id) in a given list of CSS files.
 * @param files List of files to parse.
 * @param cache SelectorCache to ensure we are working with the same selector instances.
 * @param idents Object of type IdentTypes to indicate idents to traverse over.
 * @param cb Callback function passed the identifier, rule and parsed selector.
 */
export function eachFileIdent(files: ParsedCssFile[], cache: SelectorCache, idents: IdentTypes, cb: (node: IdentNode, rule: postcss.Rule, sel: ParsedSelector) => void) {
  eachFileSelector(files, cache, (rule, sel) => eachSelectorIdent(sel, idents, (node) => cb(node, rule, sel)));
}

/**
 * Iterate over all selectors in a list of CSS files.
 * @param files List of ParsedCssFile files to iterate over.
 * @param cache SelectorCache to ensure we are working with the same selector instances.
 * @param cb Callback function passed the rule and parsed selector.
 */
export function eachFileSelector(files: ParsedCssFile[], cache: SelectorCache, cb: (rule: postcss.Rule, sel: ParsedSelector) => void) {
  files.forEach(file => eachSelector(file.content.root!, cache, cb));
}

/**
 * Iterate over all selectors in a single postcss tree.
 * @param root Postcss root to walk.
 * @param cache SelectorCache to ensure we are working with the same selector instances.
 * @param cb Callback function passed the rule and parsed selector.
 */
export function eachSelector(root: postcss.Root, cache: SelectorCache, cb: (rule: postcss.Rule, sel: ParsedSelector) => void) {
  walkRules(root, (rule) => cache.getParsedSelectors(rule).forEach((sel: ParsedSelector) => cb(rule, sel)));
}

const NODE_TYPES = {
  "root": true,
  "atrule": true,
  "rule": true,
  "decl": true,
  "comment": true,
};

type MaybeNode = { type?: postcss.Node["type"] };

export function isNode(node: whatever): node is postcss.Node {
  let nodeType = isObject(node) && (<MaybeNode>node).type || undefined;
  return nodeType && NODE_TYPES[nodeType] || false;
}

/**
 * Test if a postcss node is an at-rule.
 * @param node postcss node to test.
 * @returns True or false if node is an at-rule.
 */
export function isAtRule(node: whatever): node is postcss.AtRule {
  return (isObject(node) && (<MaybeNode>node).type === "atrule");
}

/**
 * Test if a postcss node is a rule.
 * @param node postcss node to test.
 * @returns True or false if node is a rule.
 */
export function isRule(node: whatever): node is postcss.Rule {
  return (isObject(node) && (<MaybeNode>node).type === "rule");
}

/**
 * Test if a postcss node is a declaration.
 */
export function isDeclaration(node: whatever): node is postcss.Declaration {
  return (isObject(node) && (<MaybeNode>node).type === "decl");
}

/**
 * Test if a postcss node is a container (Root, At-Rule, or Rule).
 * @param node postcss node to test.
 * @returns whether the node is a container.
 */
export function isContainer(node: whatever): node is postcss.Container {
  return isNode(node) && (<postcss.Container>node).each !== undefined;
}

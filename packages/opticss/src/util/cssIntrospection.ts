import { isObject } from "@opticss/util";
import * as postcss from "postcss";
import * as selectorParser from "postcss-selector-parser";
import { isClassName, isIdentifier } from "postcss-selector-parser";

import { ParsedCssFile } from "../CssFile";
import { ParsedSelector } from "../parseSelector";
import { SelectorCache } from "../query";

export type RuleScope = Array<postcss.AtRule>;
export type RuleIteratorWithScope = (rule: postcss.Rule, scope: RuleScope) => false | undefined | void;

export function walkRules(container: postcss.Container, eachRule: RuleIteratorWithScope): void {
  _walkRulesWithScope(container, eachRule, []);
}

function _walkRulesWithScope(container: postcss.Container, eachRule: RuleIteratorWithScope, scope: RuleScope) {
  container.each((node: postcss.ChildNode) => {
    if (isRule(node)) {
      eachRule(node, scope);
    }
    else if (isAtRule(node)) {
      if (node.name.includes("keyframes") || node.name.includes("font-face")) {
        // skip it, keyframe and font-face at-rules aren't optimizable.
      } else {
        _walkRulesWithScope(node, eachRule, scope.concat(node));
      }
    }
    // Otherwise skip it, other possible ChildNode types are `Declaration`
    // or `CommentNode`, we don't care about those.
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

type MaybeNode = { type?: postcss.Node["type"] };

/**
 * Test if a postcss node is an at-rule.
 * @param node postcss node to test.
 * @returns True or false if node is an at-rule.
 */
export function isAtRule(node: unknown): node is postcss.AtRule {
  return (isObject(node) && (<MaybeNode>node).type === "atrule");
}

/**
 * Test if a postcss node is a rule.
 * @param node postcss node to test.
 * @returns True or false if node is a rule.
 */
export function isRule(node: unknown): node is postcss.Rule {
  return (isObject(node) && (<MaybeNode>node).type === "rule");
}

/**
 * Test if a postcss node is a declaration.
 */
export function isDeclaration(node: unknown): node is postcss.Declaration {
  return (isObject(node) && (<MaybeNode>node).type === "decl");
}

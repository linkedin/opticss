import * as parse5 from "parse5";
import * as postcss from "postcss";
import { inspect } from "util";

export type RuleScope = Array<postcss.AtRule>;
export type RuleIteratorWithScope = (rule: postcss.Rule, scope: RuleScope) => false | undefined | void;

export type BodyElement = parse5.AST.HtmlParser2.Element & parse5.AST.HtmlParser2.ParentNode & {
  nodeName: "body";
  tagName: "body";
};

export function isRule(node: postcss.Node): node is postcss.Rule {
  return node.type === "rule";
}

export function isAtRule(node: postcss.Node): node is postcss.AtRule {
  return node.type === "atrule";
}

export function isContainer(node: postcss.Node): node is postcss.Container {
  return (<postcss.Container>node).each !== undefined;
}

export function walkRules(container: postcss.Container, eachRule: RuleIteratorWithScope): void {
  _walkRulesWithScope(container, eachRule, []);
}

function _walkRulesWithScope(container: postcss.Container, eachRule: RuleIteratorWithScope, scope: RuleScope) {
  container.each(node => {
    if (isRule(node)) {
      eachRule(node, scope);
    } else if (isAtRule(node)) {
      if (node.name.includes("keyframes")) {
        // skip it, keyframe stops aren't selectors.
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

export function allElements(parent: parse5.AST.HtmlParser2.ParentNode): Array<parse5.AST.HtmlParser2.Element> {
  let els = new Array<parse5.AST.HtmlParser2.Element>();
  walkElements(parent, (el) => {
    els.push(el);
  });
  return els;
}

export type StartTagCallback = (node: parse5.AST.HtmlParser2.Element) => EndTagCallback;
export type EndTagCallback = ((node: parse5.AST.HtmlParser2.Element) => void) | undefined | void;
/**
 * invokes the callback with each element in the document via a depth first traversal.
 */
export function walkElements(node: parse5.AST.HtmlParser2.Node | parse5.AST.HtmlParser2.ParentNode, cb: StartTagCallback): void {
  let endTagCB: EndTagCallback = undefined;
  if (isElement(node)) {
    endTagCB = cb(node);
  }
  if (isParentNode(node)) {
    node.childNodes.forEach((node) => {
      walkElements(node, cb);
    });
  }
  if (endTagCB && isElement(node)) {
    endTagCB(node);
  }
}

export function isElement(node: parse5.AST.HtmlParser2.Node): node is parse5.AST.HtmlParser2.Element {
  if ((<parse5.AST.HtmlParser2.Element>node).tagName) {
    return true;
  } else {
    return false;
  }
}

export function isParentNode(node: parse5.AST.HtmlParser2.Node | parse5.AST.HtmlParser2.ParentNode): node is parse5.AST.HtmlParser2.ParentNode {
  if ((<parse5.AST.HtmlParser2.ParentNode>node).childNodes) {
    return true;
  } else {
    return false;
  }
}

export function parseStylesheet(content: string): Promise<postcss.Result> {
  return new Promise<postcss.Result>((resolve, reject) => {
    postcss().process(content, {from: "stylesheet.css"}).then(resolve, reject);
  });
}

export function parseHtml(html: string): parse5.AST.HtmlParser2.Document {
  return parse5.parse(html, {
    treeAdapter: parse5.treeAdapters.htmlparser2,
  }) as parse5.AST.HtmlParser2.Document;
}

export function bodyElement(document: parse5.AST.HtmlParser2.Document): BodyElement | undefined {
  let html = document.childNodes.find(child => isElement(child) && child.tagName === "html");
  if (html && isParentNode(html)) {
    return html.childNodes.find(child => isElement(child) && child.tagName === "body") as BodyElement | undefined;
  } else {
    return;
  }
}

/**
 * serializes an element and it's children to a string.
 */
export function serializeElement(element: parse5.AST.HtmlParser2.Element): string {
  return parse5.serialize({children: [element]}, {treeAdapter: parse5.treeAdapters.htmlparser2});
}

/**
 * outputs the element's opening tag only.
 */
export function debugElement(element: parse5.AST.HtmlParser2.Element): string {
  if (!element || !element.attribs) {
    return inspect(element);
  }
  let tagName = element.name;
  let attrs = Object.keys(element.attribs).reduce((s, a, i) => {
    if (i > 0) {
      s += " ";
    }
    s += `${a}="${element.attribs[a]}"`;
    return s;
  },                                              "");
  return `<${tagName} ${attrs}>`;
}

export function documentToString(document: parse5.AST.HtmlParser2.Document): string {
  return parse5.serialize(bodyElement(document)!, { treeAdapter: parse5.treeAdapters.htmlparser2 });
}

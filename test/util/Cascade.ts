import * as parse5 from "parse5";
import * as postcss from "postcss";
import * as CSSselect from "css-select";
import * as specificity from "specificity";
import * as propParser from "css-property-parser";
import { inspect } from "util";
import { walkRules } from "../../src/optimizations/util";
import { fullyExpandShorthandProperty, expandPropertyName } from "../../src/util/shorthandProperties";

type Document = parse5.AST.HtmlParser2.Document;
type Node = parse5.AST.HtmlParser2.Node;
type ParentNode = parse5.AST.HtmlParser2.ParentNode;
type HtmlElement = parse5.AST.HtmlParser2.Element;
type BodyElement = HtmlElement & ParentNode & {
  nodeName: "body";
  tagName: "body";
};

export interface PseudoStates {
  /**
   * Maps the pseudo-state's name to the elements for which
   * that state can affect the computed style of an element.
   */
  [pseudostate: string]: Array<HtmlElement>;

}

export interface StyledPseudoElements {
  /**
   * Maps the pseudo-element's name to its computed style
   * The name does not include the preceding colon(s).
   */
  [pseudoelement: string]: ElementStyle;
}

/**
 * The styles computed from the cascade for an element in a particular state.
 */
export interface ComputedStyle {
  [property: string]: string;
}

export class ElementStyle {
  matchedSelectors: Array<MatchedSelector>;
  /**
   * Track whether the selectors are out of order and need to be re-sorted;
   */
  private dirty: boolean;
  constructor() {
    this.matchedSelectors = new Array();
    this.dirty = false;
  }
  /**
   * @returns All possible pseudostates for this element and related elements.
   */
  pseudoStates(): PseudoStates {
    return {};
  }
  /**
   * @returns map of pseudo elements with styles to the computed style. The
   * name of the pseudo-element should not include the preceding colon(s).
   */
  styledPseudoElements(): StyledPseudoElements {
    return {};
  }
  pseudoElementStyle(_name: string): ElementStyle {
    return new ElementStyle();
  }
  add(selector: string, rule: postcss.Rule, specificity: specificity.Specificity) {
    this.dirty = true;
    this.matchedSelectors.push({
      selector,
      rule,
      specificity
    });
  }
  private clean(): void {
    if (this.dirty) {
      this.dirty = false;
      // This is a shitty hack to make sorting stable on v8.
      let indexMap = new Map<MatchedSelector, number>();
      // possible optimization: sort all selectors at the beginning instead
      // of for each element.
      this.matchedSelectors.forEach((m, i) => {
        indexMap.set(m, i);
      });
      this.matchedSelectors.sort((a, b) => {
        let cmp = specificity.compare(a.specificity.specificityArray,
                                      b.specificity.specificityArray);
        if (cmp === 0) {
          return (indexMap.get(a)! < indexMap.get(b)!) ? -1 : 1;
        } else {
          return cmp;
        }
      });
    }
  }
  // TODO: accept argument for pseudostates
  compute(): ComputedStyle {
    this.clean();
    let style: ComputedStyle = {};
    let importants = new Array<postcss.Declaration>();
    this.matchedSelectors.forEach(match => {
      match.rule.walkDecls((decl) => {
        if (decl.important) {
          importants.push(decl);
        } else {
          Object.assign(style, stylesForDeclaration(decl));
        }
      });
    });
    importants.forEach(decl => {
      Object.assign(style, stylesForDeclaration(decl));
    });
    return style;
  }
  debug(): string {
    this.clean();
    let ruleSets = new Array<string>();
    this.matchedSelectors.forEach(m => {
      let declarations = new Array<string>(`${m.selector} {`);
      m.rule.walkDecls(decl => {
        declarations.push("  " + decl.toString());
      });
      declarations.push("}");
      ruleSets.push(declarations.join("\n"));
    });
    return ruleSets.join("\n\n");
  }
}

function stylesForDeclaration(decl: postcss.Declaration): ComputedStyle {
  if (propParser.isShorthandProperty(decl.prop)) {
    let style: ComputedStyle = {};
    let expandedProps = expandPropertyName(decl.prop, true);
    for (let prop of expandedProps) {
      style[prop] = "initial";
    }
    Object.assign(
      style,
      fullyExpandShorthandProperty(decl.prop, decl.value)
    );
    return style;
  } else {
    return {
      [decl.prop]: decl.value
    };
  }
}

export interface MatchedSelector {
  selector: string;
  rule: postcss.Rule;
  specificity: specificity.Specificity;
}

export class Cascade {
  stylesheet: string;
  html: Document;
  constructor(stylesheet: string, html: Document) {
    this.stylesheet = stylesheet;
    this.html = html;
  }
  perform(): Promise<Map<HtmlElement, ElementStyle>> {
    let map = new Map<HtmlElement, ElementStyle>();
    let bodyEl = bodyElement(this.html)!;
    let selectOpts: { strict: true };
    return parseStylesheet(this.stylesheet).then(result => {
      walkRules(result.root!, rule => {
        if (rule.selectors) {
          if (rule.parent.type === "atrule" && (<postcss.AtRule>rule.parent).name.includes("keyframes")) {
            return;
          }
          rule.selectors.forEach(selector => {
            let s = specificity.calculate(selector)[0];
            // TODO: handle pseudo states and classes here before selecting.
            try{
            let matchedElements = CSSselect(selector, bodyEl, selectOpts);
            // console.log(`selector "${selector}" matched ${matchedElements.length} elements`);
            matchedElements.forEach(e => {
              let style = map.get(e);
              if (!style) {
                style = new ElementStyle();
                map.set(e, style);
              }
              style.add(selector, rule, s);
            });
          } catch (e) {
            if (e.message && e.message.match(/unmatched pseudo-(class|element)/)) {
              // pass
            } else {
              throw e;
            }
          }
          });
        }
      });
      return map;
    });
  }
}

export function allElements(parent: ParentNode): Array<HtmlElement> {
  let els = new Array<HtmlElement>();
  walkElements(parent, (el) => {
    els.push(el);
  });
  return els;
}

export function walkElements(node: Node | ParentNode, cb: (node: HtmlElement) => void): void {
  if (isElement(node)) {
    cb(node);
  }
  if (isParentNode(node)) {
    node.childNodes.forEach((node) => {
      walkElements(node, cb);
    });
  }
}

export function isElement(node: Node): node is HtmlElement {
  if ((<HtmlElement>node).tagName) {
    return true;
  } else {
    return false;
  }
}

export function isParentNode(node: Node | ParentNode): node is ParentNode {
  if ((<ParentNode>node).childNodes) {
    return true;
  } else {
    return false;
  }
}

function parseStylesheet(content: string): Promise<postcss.Result> {
  return new Promise<postcss.Result>((resolve, reject) => {
    postcss().process(content, {from: "stylesheet.css"}).then(resolve, reject);
  });
}

export function parseHtml(html: string): Document {
  return parse5.parse(html, {
    treeAdapter: parse5.treeAdapters.htmlparser2
  }) as Document;
}

export function bodyElement(document: Document): BodyElement | undefined {
  let html = document.childNodes.find(child => isElement(child) && child.tagName === "html");
  if (html && isParentNode(html)) {
    return html.childNodes.find(child => isElement(child) && child.tagName === "body") as BodyElement | undefined;
  } else {
    return;
  }
}

export function serializeElement(element: HtmlElement): string {
  return parse5.serialize({children: [element]}, {treeAdapter: parse5.treeAdapters.htmlparser2});
}

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
  }, "");
  return `<${tagName} ${attrs}>`;
}
import * as parse5 from "parse5";
import * as postcss from "postcss";
import * as CSSselect from "css-select";
import * as specificity from "specificity";
import * as propParser from "css-property-parser";

type Document = parse5.AST.HtmlParser2.Document;
type Node = parse5.AST.HtmlParser2.Node;
type ParentNode = parse5.AST.HtmlParser2.ParentNode;
type HtmlElement = parse5.AST.HtmlParser2.Element;

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
    let expandedProps = propParser.getShorthandComputedProperties(decl.prop);
    expandedProps.forEach(prop => {
      style[prop] = "initial";
    });
    Object.assign(
      style,
      propParser.expandShorthandProperty(decl.prop, decl.value)
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
  private elements(): Array<HtmlElement> {
    let all = new Array<HtmlElement>();
    walkElements(this.html, (element) => {
      all.push(element);
    });
    return all;
  }
  perform(): Promise<Map<HtmlElement, ElementStyle>> {
    let map = new Map<HtmlElement, ElementStyle>();
    let elements = this.elements();
    let selectOpts: { strict: true };
    return parseStylesheet(this.stylesheet).then(result => {
      result.root!.walkRules(rule => {
        if (rule.selectors) {
          rule.selectors.forEach(selector => {
            let s = specificity.calculate(selector)[0];
            // TODO: handle pseudo states and classes here before selecting.
            let matchedElements = CSSselect(selector, elements, selectOpts);
            // console.log(`selector "${selector}" matched ${matchedElements.length} elements`);
            matchedElements.forEach(e => {
              let style = map.get(e);
              if (!style) {
                style = new ElementStyle();
                map.set(e, style);
              }
              style.add(selector, rule, s);
            });
          });
        }
      });
      return map;
    });
  }
}

export function walkElements(parent: ParentNode, cb: (node: HtmlElement) => void): void {
  parent.childNodes.forEach((node) => {
    if (isElement(node)) {
      cb(node);
    }
    if (isParentNode(node)) {
      walkElements(node, cb);
    }
  });
}

function isElement(node: Node): node is HtmlElement {
  if ((<HtmlElement>node).tagName) {
    return true;
  } else {
    return false;
  }
}

function isParentNode(node: Node | ParentNode): node is ParentNode {
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
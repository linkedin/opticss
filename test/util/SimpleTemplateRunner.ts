import * as parse5 from "parse5";
import * as Random from "random-js";
import { SimpleAnalyzer, HasAnalysisId } from "./SimpleAnalyzer";
import { TestTemplate } from "./TestTemplate";
import { TemplateAnalysis } from "../../src/TemplateAnalysis";
import { FlattenedAttributeValue, isAbsent, isUnknown, isConstant, isUnknownIdentifier, isStartsWith, isEndsWith, isStartsAndEndsWith, isSet, isFlattenedSet, isChoice, Attribute, AttributeNS } from "../../src/Selectable";
import assertNever from "../../src/util/assertNever";
import { AttributeValueParser } from "./AttributeValueParser";

type Document = parse5.AST.Default.Document;
type ParentNode = parse5.AST.Default.ParentNode;
type HtmlElement = parse5.AST.Default.Element;
type HtmlAttribute = parse5.AST.Default.Attribute;

interface VariableAttribute {
  element: HtmlElement;
  attribute: HtmlAttribute;
  values: Array<FlattenedAttributeValue>;
}

interface ConcreteAttribute {
  element: HtmlElement;
  attribute: HtmlAttribute;
  value: string | null;
}

interface PreparedDocument {
  document: Document;
  variableAttrs: Array<VariableAttribute>;
}

export class SimpleTemplateRunner {
  analysis: Promise<TemplateAnalysis<"TestTemplate">>;
  analyzer: SimpleAnalyzer;
  template: TestTemplate;
  random: Random;
  constructor(template: TestTemplate, randomSeed?: number) {
    this.template = template;
    this.analyzer = new SimpleAnalyzer(template);
    this.analysis = this.analyzer.analyze();
    let engine = Random.engines.mt19937();
    if (randomSeed) {
      engine = engine.seed(randomSeed);
    } else {
      engine = engine.autoSeed();
    }
    this.random = new Random(engine);
  }
  prepareDocument(): PreparedDocument {
    const valueParser = new AttributeValueParser();
    let document = parse5.parse(this.template.contents, {
      treeAdapter: parse5.treeAdapters.default
    }) as parse5.AST.Default.Document;

    let variableAttrs = new Array<VariableAttribute>();

    walkElements(document, (element) => {
      element.attrs.forEach(attr => {
        let value = valueParser.parse(attr.value, attr.namespace === undefined && attr.name === "class");
        let attribute: Attribute | AttributeNS = attr.namespace ? new Attribute(attr.name, value) : new AttributeNS(attr.namespace!, attr.name, value);
        let flattened = attribute.flattenedValue();
        if (flattened.length > 1) {
          variableAttrs.push({
            attribute: attr,
            element: element,
            values: flattened
          });
        } else {
          let concrete = this.concreteValue(flattened[0]);
          attr.value = concrete || "";
        }
      });
    });
    return {
      document,
      variableAttrs
    };
  }
  run(document: Document, attributes: Array<ConcreteAttribute>): string {
    attributes.forEach(attr => {
      attr.attribute.value = attr.value || "";
    });
    return bodyContents(document);
  }
  runOnce(): Promise<string> {
    let preparedDocument = this.prepareDocument();
    let concreteAttrs: ConcreteAttribute[] = preparedDocument.variableAttrs.map(attr => {
      return {
        attribute: attr.attribute,
        element: attr.element,
        value: this.concreteValue(attr.values[0])
      };
    });
    return Promise.resolve(this.run(preparedDocument.document, concreteAttrs));
  }
  runAll(): Promise<string[]> {
    let preparedDocument = this.prepareDocument();
    let allConcreteAttrs = this.permuteAttributeValues(preparedDocument.variableAttrs);
    let allRuns = allConcreteAttrs.map(attrs => this.run(preparedDocument.document, attrs));
    return Promise.resolve(allRuns);
  }
  runSample(amount: number): Promise<string[]> {
    if (amount < 1 && amount > 0) {
      // percentage
      return Promise.resolve(new Array<string>());
    } else {
      // absolute number
      return Promise.resolve(new Array<string>());
    }
  }
  concreteValue(value: FlattenedAttributeValue): string | null {
    if (isAbsent(value)) {
      return null;
    } else if (isUnknown(value)) {
      return `${this.random.string(4)}${this.possibleSpace()}${this.random.string(4)}`;
    } else if (isUnknownIdentifier(value)) {
      return this.random.string(5);
    } else if (isConstant(value)) {
      return value.constant;
    } else if (isStartsWith(value)) {
      return value.whitespace ?
        `${value.startsWith}${this.word(4)}${this.possibleSpace()}${this.word(3)}` :
        value.startsWith + this.random.string(4);
    } else if (isEndsWith(value)) {
      return value.whitespace ?
        `${this.random.string(4)}${this.possibleSpace()}${this.word(3)}${value.endsWith}` :
        this.random.string(4) + value.endsWith;
    } else if (isStartsAndEndsWith(value)) {
      return value.whitespace ?
        `${value.startsWith}${this.word(4)}${this.possibleSpace()}${this.word(3)}${value.endsWith}` :
        `${value.startsWith}${this.word(4)}${value.endsWith}`;
    } else if (isFlattenedSet(value)) {
      return value.allOf.map(v => this.concreteValue(v)).join(" ");
    } else {
      return assertNever(<never>value);
    }
  }
  private possibleSpace(): string {
    return this.random.string(1," -");
  }
  private word(length: number): string {
    return this.random.string(length);
  }
  permuteAttributeValues(attributes: VariableAttribute[], i = 0): ConcreteAttribute[][] {
    let concreteAttrs = new Array<ConcreteAttribute[]>();
    if (i === attributes.length) {
      concreteAttrs.push(new Array<ConcreteAttribute>());
      return concreteAttrs;
    }
    let nextConcreteAttrs = this.permuteAttributeValues(attributes, i+1);
    attributes[i].values.forEach(v => {
      let concrete = this.concreteValue(v);
      nextConcreteAttrs.forEach(nv => {
        let copy = nv.slice();
        copy.unshift({
          element: attributes[i].element,
          attribute: attributes[i].attribute,
          value: concrete
        });
        concreteAttrs.push(copy);
      });

    });
    return concreteAttrs;
  }
}

export function bodyContents(document: Document): string {
  let html = document.childNodes[0];
  if (isParentNode(html)) {
    let body = (<ParentNode>html).childNodes[1];
    return parse5.serialize(body);
  } else {
    return assertNever(<never>html);
  }
}

function isElement(node: parse5.AST.Default.Node): node is parse5.AST.Default.Element {
  if ((<parse5.AST.Default.Element>node).tagName) {
    return true;
  } else {
    return false;
  }
}
function isParentNode(node: parse5.AST.Default.Node | parse5.AST.Default.ParentNode): node is parse5.AST.Default.ParentNode {
  if ((<parse5.AST.Default.ParentNode>node).childNodes) {
    return true;
  } else {
    return false;
  }
}

export function allElements(parent: ParentNode): Array<HtmlElement> {
  let els = new Array<HtmlElement>();
  walkElements(parent, (el) => {
    els.push(el);
  });
  return els;
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
import {
  Attribute as SelectableAttribute,
  ElementInfo,
  isConstant,
  isTagnameValueChoice,
} from "../../element-analysis/src";
import {
  IdentityDictionary,
  ItemType,
  assertNever,
  unionInto,
  whatever,
} from "../../util/src";
import {
  Dictionary, MultiDictionary,
} from "typescript-collections";

import { AndExpression, BooleanExpression, OrExpression, isAndExpression, isNotExpression, isOrExpression } from "./BooleanExpression";
import { TemplateIntegrationOptions } from "./TemplateIntegrationOptions";

export interface RewriteInformation<InfoType> {
  id: InfoType;
  class: InfoType;
}

export type RewriteableAttrName = keyof RewriteInformation<whatever>;

export const REWRITE_ATTRS = new Array<RewriteableAttrName>("id", "class");
Object.freeze(REWRITE_ATTRS);

export interface DynamicExpressions {
  [outputValue: string]: BooleanExpression<number> | undefined;
}

export interface RewriteMapping {
  /**
   * attributes as they appear in the source template.
   */
  inputs: Array<SimpleTagname | SimpleAttribute>;

  /**
   * output attributes that are always on the element independent of any dynamic changes.
   */
  staticAttributes: RewriteInformation<string[]>;

  /**
   * The numbers in the boolean expressions represents indexes into the inputAttributes array.
   * For attributes that are not whitespace delimited (E.g. id) only one value
   * will evaluate to true unless the element analysis itself is invalid.
   */
  dynamicAttributes: RewriteInformation<DynamicExpressions>;
}

export interface SimpleTagname {
  ns?: string;
  tagname: string;
}
export function isSimpleTagname(v: Object): v is SimpleTagname {
  return typeof (<SimpleTagname>v).tagname === "string";
}
export interface SimpleAttribute {
  ns?: string;
  name: string;
  value: string;
}
export function isSimpleAttribute(v: Object): v is SimpleAttribute {
  return typeof (<SimpleAttribute>v).value === "string"
      && typeof (<SimpleAttribute>v).name  === "string";
}

export function simpleAttributeToString(attr: SimpleAttribute): string {
  if (attr.ns) {
    if (attr.value) {
      return `${attr.ns}:${attr.name}="${attr.value}"`;
    } else {
      return `${attr.ns}:${attr.name}`;
    }
  } else {
    if (attr.value) {
      return `${attr.name}="${attr.value}"`;
    } else {
      return `${attr.name}`;
    }
  }
}

export interface ElementAttributes {
  /**
   * A list of traits that should be on the element.
   */
  existing: Array<SimpleTagname | SimpleAttribute>;
  /**
   * a list of traits that shouldn't be on the element.
   */
  unless: Array<SimpleTagname | SimpleAttribute>;
}

interface PrimaryAttributeLink {
  /**
   * The optimized attribute that is linked to the source attribute.
   */
  to: SimpleAttribute;
  /**
   * A list of traits that must be present to create the link.
   */
  from: Array<SimpleTagname | SimpleAttribute>;
  /**
   * A list of traits that must not be present to to create the link.
   */
  unless: Array<SimpleTagname | SimpleAttribute>;
}

export class StyleMapping {
  private templateOptions: TemplateIntegrationOptions;
  private replacedAttributes: Dictionary<SimpleAttribute, SimpleAttribute>;
  private linkedAttributes: MultiDictionary<SimpleAttribute, PrimaryAttributeLink>;
  private sourceAttributes: IdentityDictionary<SimpleAttribute>;
  private optimizedAttributes: IdentityDictionary<SimpleAttribute>;
  private obsoleteAttributes: IdentityDictionary<SimpleAttribute>;
  constructor(templateOptions: TemplateIntegrationOptions) {
    this.templateOptions = templateOptions;
    this.replacedAttributes = attributeDictionary();
    this.linkedAttributes = attributeMultiDictionary<PrimaryAttributeLink>();
    this.sourceAttributes = new IdentityDictionary(attrToKey);
    this.optimizedAttributes = new IdentityDictionary(attrToKey);
    this.obsoleteAttributes = new IdentityDictionary(attrToKey);
  }
  attributeIsObsolete(attr: SimpleAttribute) {
    this.obsoleteAttributes.add(attr);
  }
  rewriteAttribute(from: SimpleAttribute, to: SimpleAttribute): void {
    if (this.optimizedAttributes.has(from)) {
      this.optimizedAttributes.update(from, (actual) => {
        actual.ns = to.ns;
        actual.name = to.name;
        actual.value = to.value;
      });
    } else {
      this.replacedAttributes.setValue(
        this.sourceAttributes.add(from),
        this.optimizedAttributes.add(to),
      );
    }
  }
  linkAttributes(newAttr: SimpleAttribute, toAttrs: Array<ElementAttributes>) {
    newAttr = this.optimizedAttributes.add(newAttr);
    for (let attrCondition of toAttrs) {
      let link: PrimaryAttributeLink = {
        to: newAttr,
        from: attrCondition.existing.map(a => isSimpleAttribute(a) ? this.sourceAttributes.add(a) : a),
        unless: attrCondition.unless.map(a => isSimpleAttribute(a) ? this.sourceAttributes.add(a) : a),
      };
      for (let sourceAttr of link.from) {
        if (isSimpleTagname(sourceAttr)) continue;
        this.linkedAttributes.setValue(sourceAttr, link);
      }
    }
  }
  getRewriteOf(from: SimpleAttribute): SimpleAttribute | undefined {
    return this.replacedAttributes.getValue(from);
  }
  private getInputs(element: ElementInfo): Array<SimpleTagname | SimpleAttribute> {
    // TODO: base the input attributes on all attributes on the element
    let inputs = new Array<SimpleTagname | SimpleAttribute>();
    if (isConstant(element.tagname.value)) {
      inputs.push({tagname: element.tagname.value.constant});
    } else if (isTagnameValueChoice(element.tagname.value)) {
      for (let v of element.tagname.value.oneOf) {
        inputs.push({tagname: v});
      }
    }

    for (let attr of element.attributes) {
      if (this.templateOptions.analyzedAttributes.includes(attr.name)) {
        let attrInputs = this.attributeValues(attr);
        if (attrInputs.length === 0) {
          attrInputs.push({
            ns: attr.namespaceURL || undefined,
            name: attr.name,
            value: "",
          });
        }
        inputs.splice(inputs.length, 0, ...attrInputs);
      }
    }
    return inputs;
  }

  rewriteMapping(element: ElementInfo): RewriteMapping {
    let inputs = this.getInputs(element);
    let staticAttributes: RewriteInformation<Set<string>> = {id: new Set<string>(), class: new Set<string>()};
    let dynamicAttributes: RewriteMapping["dynamicAttributes"] = {id: {}, class: {}};
    for (let i = 0; i < inputs.length; i++) {
      let input = inputs[i];
      if (isSimpleTagname(input)) continue;
      let inputAttr = input;
      let rwc = inputAttr && this.getRewriteOf(inputAttr);
      if (rwc) {
        dynamicAttributes[this.toRewritableAttrName(rwc.name)][rwc.value] = {and: [i]};
      } else if (inputAttr
                 && !this.obsoleteAttributes.has(inputAttr)
                 && inputAttr.ns === undefined
                 && this.templateOptions.rewriteIdents[inputAttr.name]) {
        dynamicAttributes[this.toRewritableAttrName(inputAttr.name)][inputAttr.value] = {and: [i]};
      }
      let linkages = this.linkedAttributes.getValue(inputAttr);
      for (let linked of linkages) {
        if (linked) {
          let condition: AndExpression<number> = { and: linked.from.map(linkedAttr => inputs.findIndex(input => sameElementTrait(input, linkedAttr))) };
          if (condition.and.some(c => c < 0)) {
            // this condition can never be met if this class never has all the required source attributes
            continue;
          }
          for (let linkedAttr of linked.unless) {
            let idx = inputs.findIndex(input => sameElementTrait(input, linkedAttr));
            if (idx >= 0) {
              condition.and.push({ not: idx });
            }
          }
          let dynExpr = dynamicAttributes[this.toRewritableAttrName(linked.to.name)][linked.to.value];
          if (dynExpr) {
            if (isOrExpression(dynExpr)) {
              dynExpr.or.push(condition);
            } else {
              dynExpr = { or: [dynExpr, condition] };
            }
          } else {
            dynExpr = condition;
          }
          dynamicAttributes[this.toRewritableAttrName(linked.to.name)][linked.to.value] = dynExpr;
        }
      }
      for (let key of REWRITE_ATTRS) {
        let extracted = extractStatic(element, inputs, dynamicAttributes[key]);
        unionInto(staticAttributes[key], extracted);
      }
    }
    return {
      inputs,
      staticAttributes: {id: [...staticAttributes.id], class: [...staticAttributes.class]},
      dynamicAttributes,
    };
  }
  replacedAttributeCount(): number {
    return this.replacedAttributes.size();
  }
  private isRewritableAttrName(name: string): name is RewriteableAttrName {
    if (this.templateOptions.rewriteIdents[name]) {
      return true;
    } else {
      return false;
    }
  }
  private toRewritableAttrName(name: string): RewriteableAttrName {
    if (this.isRewritableAttrName(name)) {
      return name;
    } else {
      throw new Error("Internal Error: Rewritable attribute name (id or class) required");
    }
  }
  attributeValues(attr: SelectableAttribute): SimpleAttribute[] {
    // TODO: this needs to come from values found in the stylesheet that may
    // match the value descriptors -- not to be derived from the analysis for
    // our immediate needs this works tho and it's much faster than
    // deriving it from the styles.
    // let names = new Set<string>();
    let names = attr.constants();
    let nameArray = new Array(...names);
    nameArray.sort();
    return nameArray.map(value => {
      return {
        name: attr.name,
        value,
      };
    });
  }
}

function sameElementTrait<T extends SimpleTagname | SimpleAttribute>(trait1: T, trait2: T): boolean {
  if (isSimpleTagname(trait1)) {
    return sameTagname(trait1, <SimpleTagname>trait2);
  } else if (isSimpleAttribute(trait1)) {
    return sameAttribute(trait1, <SimpleAttribute>trait2);
  } else {
    return false;
  }
}
function sameTagname(tag1: SimpleTagname, tag2: SimpleTagname) {
  return tag1.ns === tag2.ns &&
         tag1.tagname === tag2.tagname;
}
function sameAttribute(attr1: SimpleAttribute, attr2: SimpleAttribute) {
  return attr1.ns === attr2.ns &&
         attr1.name === attr2.name &&
         attr1.value === attr2.value;
}

function attributeDictionary<V = SimpleAttribute>(): Dictionary<SimpleAttribute, V> {
  return new Dictionary<SimpleAttribute, V>(attrToKey);
}

function attributeMultiDictionary<V>(
  valueEqualsFn?: (a: V, b: V) => boolean,
  allowDuplicateValues = false,

): MultiDictionary<SimpleAttribute, V> {
  return new MultiDictionary<SimpleAttribute, V>(attrToKey, valueEqualsFn, allowDuplicateValues);
}

function attrToKey(attr: SimpleAttribute): string {
  return `${attr.ns || ""}|${attr.name}=${attr.value}`;
}

function extractStatic(element: ElementInfo, inputs: RewriteMapping["inputs"], dyn: DynamicExpressions): Array<string> {
  let result = new Array<string>();
  for (let v of Object.keys(dyn)) {
    let expr = dyn[v]!;
    let staticValue = isStatic(expr, inputs, element);
    if (staticValue === true) {
      result.push(v);
      delete dyn[v];
    }
  }
  return result;
}

function isStatic(
  value: BooleanExpression<number> | number,
  inputs: RewriteMapping["inputs"],
  element: ElementInfo,

): boolean | undefined {
  if (typeof value === "number") {
    return isStaticOnElement(inputs[value], element);
  } else if (isAndExpression(value) || isOrExpression(value)) {
    let values = ((<AndExpression<number>>value).and || (<OrExpression<number>>value).or);
    return values.reduce<undefined | boolean>(
      ((prev, a) => {
        let result = isStatic(a, inputs, element);
        if (prev === undefined) return result;
        if (result === undefined) return prev;
        return prev && result;
      }),
      undefined);
  } else if (isNotExpression(value)) {
    return isStatic(value.not, inputs, element);
  } else {
    return assertNever(value);
  }
}

function isStaticOnElement(input: ItemType<RewriteMapping["inputs"]>, element: ElementInfo): boolean | undefined {
  if (isSimpleTagname(input)) {
    return element.tagname.isStatic();
  } else if (isSimpleAttribute(input)) {
    let attribute = element.attributes.find(a => a.isNamed(input.name, input.ns));
    if (!attribute) throw new Error("internal error");
    return attribute.isStatic(input.value) !== false;
  } else {
    return assertNever(input);
  }
}

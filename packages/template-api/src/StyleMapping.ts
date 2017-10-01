import {
  Dictionary, MultiDictionary,
} from "typescript-collections";
import {
  IdentityDictionary,
  assertNever
} from "@opticss/util";
import {
  Attr,
  Attribute as SelectableAttribute,
  ElementInfo,
  FlattenedAttributeValue,
  isAbsent,
  isUnknown,
  isUnknownIdentifier,
  isConstant,
  isStartsWith,
  isEndsWith,
  isStartsAndEndsWith,
  isFlattenedSet
 } from "./Selectable";
import { BooleanExpression, AndExpression, isOrExpression } from "./BooleanExpression";

export interface DynamicClasses {
  [classname: string]: BooleanExpression<number> | undefined;
}

export interface RewriteMapping {
  /**
   * class names as they appear in the source template.
   */
  inputClassnames: string[];

  /**
   * output class names that are always on the element independent of any dynamic changes.
   */
  staticClasses: string[];

  /**
   * The numbers in the boolean expression represents indexes into the inputClassnames array.
   */
  dynamicClasses: DynamicClasses;
}

export interface SimpleAttribute {
  ns?: string;
  name: string;
  value: string;
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
   * A list of attributes that should be on the element.
   */
  existing: Array<SimpleAttribute>;
  /**
   * a list of attributes that shouldn't be on the element.
   */
  unless: Array<SimpleAttribute>;
}

interface PrimaryAttributeLink {
  /**
   * The optimized attribute that is linked to the source attribute.
   */
  to: SimpleAttribute;
  /**
   * A list of attributes that must be present to create the link.
   */
  from: Array<SimpleAttribute>;
  /**
   * A list of attributes that must not be present to to create the link.
   */
  unless: Array<SimpleAttribute>;
}

export class StyleMapping {
  private replacedAttributes: Dictionary<SimpleAttribute, SimpleAttribute>;
  private linkedAttributes: MultiDictionary<SimpleAttribute, PrimaryAttributeLink>;
  private sourceAttributes: IdentityDictionary<SimpleAttribute>;
  private optimizedAttributes: IdentityDictionary<SimpleAttribute>;
  private obsoleteAttributes: IdentityDictionary<SimpleAttribute>;
  constructor() {
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
        this.optimizedAttributes.add(to)
      );
    }
  }
  linkAttributes(newAttr: SimpleAttribute, toAttrs: Array<ElementAttributes>) {
    newAttr = this.optimizedAttributes.add(newAttr);
    for (let attrCondition of toAttrs) {
      let link: PrimaryAttributeLink = {
        to: newAttr,
        from: attrCondition.existing.map(a => this.sourceAttributes.add(a)),
        unless: attrCondition.unless.map(a => this.sourceAttributes.add(a))
      };
      for (let sourceAttr of link.from) {
        this.linkedAttributes.setValue(sourceAttr, link);
      }
    }
  }
  getRewriteOf(from: SimpleAttribute): SimpleAttribute | undefined {
    return this.replacedAttributes.getValue(from);
  }
  rewriteMapping(element: ElementInfo): RewriteMapping | null {
    let classAttr = element.attributes.find((a) => isClassAttr(a));
    let inputClassnames = classAttr ? classValues(classAttr) : [];
    let dynamicClasses: DynamicClasses = { };
    for (let i = 0; i < inputClassnames.length; i++) {
      let icn = inputClassnames[i];
      let rwc = this.getRewriteOf({name: "class", value: icn});
      if (rwc) {
        dynamicClasses[rwc.value] = {and: [i]};
      } else if (!this.obsoleteAttributes.has({name: "class", value: icn})) {
        dynamicClasses[icn] = {and: [i]};
      }
      let linkages = this.linkedAttributes.getValue({name: "class", value: icn});
      for (let linked of linkages) {
        if (linked) {
          if (!(linked.from.every(a => a.name === "class")
                && linked.unless.every(a => a.name === "class"))) {
            // TODO: Handle attributes that aren't classes at some point.
            throw new Error("only classes can be linked.");
          }
          let condition: AndExpression<number> = { and: linked.from.map(linkedAttr => inputClassnames.findIndex(c => c === linkedAttr.value)) };
          if (condition.and.some(c => c < 0)) {
            // this condition can never be met if this class never has all the required source classes
            continue;
          }
          for (let linkedAttr of linked.unless) {
            let idx = inputClassnames.findIndex(c => c === linkedAttr.name);
            if (idx >= 0) {
              condition.and.push({ not: idx });
            }
          }
          let dynClass = dynamicClasses[linked.to.value];
          if (dynClass) {
            if (isOrExpression(dynClass)) {
              dynClass.or.push(condition);
            } else {
              dynClass = { or: [dynClass, condition] };
            }
          } else {
            dynClass = condition;
          }
          dynamicClasses[linked.to.value] = dynClass;
        }
      }
    }
    return {
      inputClassnames,
      staticClasses: [],
      dynamicClasses
    };
  }
  replacedAttributeCount(): number {
    return this.replacedAttributes.size();
  }
}

function classValues(attr: SelectableAttribute): string[] {
  let names = new Set<string>();
  attr.flattenedValue().forEach(v => {
    stringsForValue(v).forEach(sv => names.add(sv));
  });
  let nameArray = new Array(...names);
  nameArray.sort();
  return nameArray;
}

function stringsForValue(v: FlattenedAttributeValue): string[] {
    if (isAbsent(v)) {
      //pass
      return [];
    } else if (isUnknown(v) || isUnknownIdentifier(v)) {
      // pass -- omg what to do here?
      return [];
    } else if (isConstant(v)) {
      return [v.constant];
    } else if (isStartsWith(v) || isEndsWith(v) || isStartsAndEndsWith(v)) {
      // We can use all known idents in the css to see which of these match?
      return [];
    } else if (isFlattenedSet(v)) {
      return v.allOf.reduce((prev, sv) => prev.concat(stringsForValue(sv)),
                            new Array<string>());
    } else {
      return assertNever(v);
    }
}

// function sameAttribute(attr1: Attribute, attr2: Attribute) {
//   return attr1.ns === attr2.ns &&
//          attr1.name === attr2.name &&
//          attr1.value === attr2.value;
// }

function isClassAttr(attr: Attr): boolean {
  return attr.namespaceURL === null && attr.name === "class";
}

function attributeDictionary<V = SimpleAttribute>(): Dictionary<SimpleAttribute, V> {
  return new Dictionary<SimpleAttribute, V>(attrToKey);
}

function attributeMultiDictionary<V>(
  valueEqualsFn?: (a: V, b: V) => boolean,
  allowDuplicateValues = false
): MultiDictionary<SimpleAttribute, V> {
  return new MultiDictionary<SimpleAttribute, V>(attrToKey, valueEqualsFn, allowDuplicateValues);
}

function attrToKey(attr: SimpleAttribute): string {
  return `${attr.ns || ''}|${attr.name}=${attr.value}`;
}
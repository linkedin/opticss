import {
  Dictionary,
} from "typescript-collections";
import {
  IdentityDictionary
} from "./util/IdentityDictionary";
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
import assertNever from "./util/assertNever";

export interface AndExpression<V> {
  and: Array<V | BooleanExpression<V>>;
}
export interface OrExpression<V> {
  or: Array<V | BooleanExpression<V>>;
}
export interface NotExpression<V> {
  not: V | BooleanExpression<V>;
}
export type BooleanExpression<V> = AndExpression<V> | OrExpression<V> | NotExpression<V>;

export interface DynamicClasses {
  [classname: string]: BooleanExpression<number>;
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

export interface Attribute {
  ns?: string;
  name: string;
  value: string;
}

export class StyleMapping {
  private replacedAttributes: Dictionary<Attribute, Attribute>;
  private sourceAttributes: IdentityDictionary<Attribute>;
  private optimizedAttributes: IdentityDictionary<Attribute>;
  constructor() {
    this.replacedAttributes = attributeDictionary();
    this.sourceAttributes = new IdentityDictionary(attrToKey);
    this.optimizedAttributes = new IdentityDictionary(attrToKey);
  }
  rewriteAttribute(from: Attribute, to: Attribute): void {
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
  getRewriteOf(from: Attribute): Attribute | undefined {
    return this.replacedAttributes.getValue(from);
  }
  rewriteMapping(element: ElementInfo): RewriteMapping | null {
    let classAttr = element.attributes.find((a) => isClassAttr(a));
    let inputClassnames = classAttr ? classValues(classAttr) : [];
    let dynamicClasses: DynamicClasses = { };
    inputClassnames.forEach((icn, i) => {
      let rwc = this.getRewriteOf({name: "class", value: icn});
      if (rwc) {
        dynamicClasses[rwc.value] = {and: [i]};
      } else {
        dynamicClasses[icn] = {and: [i]};
      }
    });
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

function isClassAttr(attr: Attr): boolean {
  return attr.namespaceURL === null && attr.name === "class";
}

function attributeDictionary<V>() {
  return new Dictionary<Attribute, V>(attrToKey);
}

function attrToKey(attr: Attribute): string {
  return `${attr.ns || ''}|${attr.name}=${attr.value}`;
}
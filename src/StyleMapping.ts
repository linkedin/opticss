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
  replacedAttributes: {
    [attrKey: string]: Attribute;
  };
  constructor() {
    this.replacedAttributes = {};
  }
  attrToKey(attr: Attribute): string {
    return `${attr.ns || ''}|${attr.name}=${attr.value}`;
  }
  rewriteAttribute(from: Attribute, to: Attribute): void {
    this.replacedAttributes[this.attrToKey(from)] = to;
  }
  getRewriteOf(from: Attribute): Attribute | undefined {
    return this.replacedAttributes[this.attrToKey(from)];
  }
  classMapping(element: ElementInfo): RewriteMapping | null {
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
import { ElementInfo } from "./Selectable";

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

export interface ClassMapping {
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
  dynamicClasses: {
    [classname: string]: BooleanExpression<number>;
  };
}

export class StyleMapping {
  classMapping(_element: ElementInfo): ClassMapping {
    return {
      inputClassnames: new Array<string>(),
      staticClasses: new Array<string>(),
      dynamicClasses: {}
    };
  }
}
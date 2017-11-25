import {
  AttributeValueChoice,
  AttributeValueChoiceOption,
  AttributeValueSet,
  AttributeValueSetItem,
  ValueAbsent,
  ValueConstant,
  ValueEndsWith,
  ValueStartsAndEndsWith,
  ValueStartsWith,
  ValueUnknown,
  ValueUnknownIdentifier,
} from "./Attribute";

export namespace attrValues {
  export function constant(constant: string): ValueConstant {
    return {constant};
  }
  export function unknown(): ValueUnknown {
    return {unknown: true};
  }
  export function unknownIdentifier(): ValueUnknownIdentifier {
    return {unknownIdentifier: true};
  }
  export function absent(): ValueAbsent {
    return {absent: true};
  }
  export function startsWith(startsWith: string, whitespace?: boolean): ValueStartsWith {
    return {startsWith, whitespace};
  }
  export function endsWith(endsWith: string, whitespace?: boolean): ValueEndsWith {
    return {endsWith, whitespace};
  }
  export function startsAndEndsWith(startsWith: string, endsWith: string, whitespace?: boolean): ValueStartsAndEndsWith {
    return {startsWith, endsWith, whitespace};
  }
  export function allOf(allOf: Array<AttributeValueSetItem>): AttributeValueSet {
    return {allOf};
  }
  export function oneOf(oneOf: Array<AttributeValueChoiceOption>): AttributeValueChoice {
    return {oneOf};
  }
}
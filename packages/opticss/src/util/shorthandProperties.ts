import * as propParser from "css-property-parser";
import { StringDict } from "@opticss/util";

export function expandPropertyName(prop: string, recursively = false): string[] {
  let props = propParser.getShorthandComputedProperties(prop);
  if (!recursively) return props;
  while (props.find(p => propParser.isShorthandProperty(p))) {
    props = props.reduce((prev, p) => {
      prev.splice(prev.length, 0, ...propParser.getShorthandComputedProperties(p));
      return prev;
    }, new Array<string>());
  }
  return props;
}

export function fullyExpandShorthandProperty(prop: string, value: string) {
  let expanded = propParser.expandShorthandProperty(prop, value, true);
  for (let p of Object.keys(expanded)) {
    if (propParser.isShorthandProperty(p)) {
      delete expanded[p];
    }
  }
  return expanded;
}

export function expandIfNecessary(authoredProps: Set<string>, prop: string, value: string): StringDict {
  if (!propParser.isShorthandProperty(prop)) {
    return {[prop]: value};
  }
  let longhandDeclarations: StringDict = {};
  let longHandProps = expandPropertyName(prop);
  let longHandValues = propParser.expandShorthandProperty(prop, value, false);
  let directAuthored = longHandProps.some(p => authoredProps.has(p));
  for (let p of longHandProps) {
    let v = longHandValues[p] || "initial"; // TODO: use the correct initial value for the property.
    let expanded = expandIfNecessary(authoredProps, p, v);
    if (Object.keys(expanded).some(key => authoredProps.has(key))) {
      Object.assign(longhandDeclarations, expanded);
    } else if (directAuthored) {
      Object.assign(longhandDeclarations, {[p]: v});
    }
  }
  if (Object.keys(longhandDeclarations).length === 0) {
    longhandDeclarations[prop] = value;
  }
  return longhandDeclarations;
}

import { StringDict } from "@opticss/util";
import * as propParser from "css-property-parser";

import {
  Actions,
  Note,
} from "../Actions";

export function expandPropertyName(prop: string, recursively = false): string[] {
  let props = propParser.getShorthandComputedProperties(prop, recursively);
  if (recursively) {
    return props.filter(p => propParser.isShorthandProperty(p));
  } else {
    return props;
  }
}

export function fullyExpandShorthandProperty(prop: string, value: string) {
  try {
    let expanded = propParser.expandShorthandProperty(prop, value, true);
    for (let p of Object.keys(expanded)) {
      if (propParser.isShorthandProperty(p)) {
        delete expanded[p];
      }
    }
    return expanded;
  } catch (e) {
    if (/parsing shorthand property/.test(e.message)) {
      // TODO: instrument this so it can be added to the optimization logger.
      // tslint:disable-next-line:no-console
      console.log(e.message + `(long hands for this declaration will not be optimized)`);
      return {
        [prop]: value,
      };
    } else {
      throw e;
    }
  }
}

export function expandIfNecessary(authoredProps: Set<string>, prop: string, value: string, actions: Actions): StringDict {
  if (!propParser.isShorthandProperty(prop)) {
    return {[prop]: value};
  }
  let longhandDeclarations: StringDict = {};
  let longHandProps;
  let longHandValues;
  try {
    longHandValues = propParser.expandShorthandProperty(prop, value, false, true);
    longHandProps = Object.keys(longHandValues);
  } catch (e) {
    if (/parsing shorthand property/.test(e.message)) {
      actions.perform(new Note("mergeDeclarations", e.message + `(long hands for this declaration will not be optimized)`));
      return { [prop]: value };
    } else {
      throw e;
    }
  }
  let directAuthored = longHandProps.some(p => authoredProps.has(p));
  for (let p of longHandProps) {
    let v = longHandValues[p];
    let expanded = expandIfNecessary(authoredProps, p, v, actions);
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

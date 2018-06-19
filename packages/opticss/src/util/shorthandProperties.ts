import { StringDict } from "@opticss/util";
import * as propParser from "css-property-parser";

import { Actions } from "../Actions";

export function expandIfNecessary(authoredProps: Set<string>, prop: string, value: string, actions: Actions): StringDict {
  if (!propParser.isShorthandProperty(prop)) {
    return {[prop]: value};
  }
  let longhandDeclarations: StringDict = {};
  let longHandProps;
  let longHandValues;

  // Because we do an `isShorthandProperty` check up top, we don't need to try catch this call.
  longHandValues = propParser.expandShorthandProperty(prop, value, false, true);
  longHandProps = Object.keys(longHandValues);

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

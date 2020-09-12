import { SourcePosition } from "@opticss/element-analysis";
import { StringDict } from "@opticss/util";
import * as propParser from "css-property-parser";
import * as postcss from "postcss";

import {
  Actions,
  Warning,
} from "../Actions";

export function expandPropertyName(prop: string, recursively = false): string[] {
  let props = propParser.getShorthandComputedProperties(prop, recursively);
  if (recursively) {
    return props.filter(p => propParser.isShorthandProperty(p));
  } else {
    return props;
  }
}

export function expandIfNecessary(authoredProps: Set<string>, prop: string, value: string, actions: Actions, decl: postcss.Declaration): StringDict {
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
      actions.perform(new Warning("mergeDeclarations", e.message + ` (long hands for this declaration will not be optimized)`, sourcePositionForNode(decl)));
      return { [prop]: value };
    } else if (/is not a supported property/.test(e.message)) {
      actions.perform(new Warning("mergeDeclarations", e.message + ` (long hands for this declaration with conflicting values will not be understood as such which could result in incorrect optimization output.)`, sourcePositionForNode(decl)));
      return { [prop]: value };
    } else {
      throw e;
    }
  }
  let directAuthored = longHandProps.some(p => authoredProps.has(p));
  for (let p of longHandProps) {
    let v = longHandValues[p];
    let expanded = expandIfNecessary(authoredProps, p, v, actions, decl);
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

function sourcePositionForNode(node: postcss.NodeBase): SourcePosition | undefined {
  if (node.source && node.source.start) {
    return {
      filename: node.source.input.file,
      line: node.source.start.line,
      column: node.source.start.column,
    };
  } else {
    return undefined;
  }
}

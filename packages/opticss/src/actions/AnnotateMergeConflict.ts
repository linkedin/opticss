import {
  ParsedSelector,
} from '../parseSelector';
import * as postcss from 'postcss';
import { Action } from "./Action";
import { Element, SourcePosition } from "@opticss/template-api";
import { Optimizations } from "../OpticssOptions";

/**
 * Changes a Rule's selector string.
 */
export class AnnotateMergeConflict extends Action {
  mergedDecl: postcss.Declaration;
  mergedSel: ParsedSelector;
  unmergedDecl: postcss.Declaration;
  unmergedSel: ParsedSelector;
  conflictDecl: postcss.Declaration;
  conflictSel: ParsedSelector;
  element: Element;

  constructor(
    mergedDecl: postcss.Declaration,
    mergedSel: ParsedSelector,
    unmergedDecl: postcss.Declaration,
    unmergedSel: ParsedSelector,
    conflictDecl: postcss.Declaration,
    conflictSel: ParsedSelector,
    element: Element,
    optimization: keyof Optimizations = "mergeDeclarations",
  ) {
    super(optimization);
    this.mergedDecl = mergedDecl;
    this.mergedSel = mergedSel;
    this.unmergedDecl = unmergedDecl;
    this.unmergedSel = unmergedSel;
    this.conflictDecl = conflictDecl;
    this.conflictSel = conflictSel;
    this.element = element;
  }

  get sourcePosition(): SourcePosition | undefined {
    return this.nodeSourcePosition(this.conflictDecl);
  }
  perform(): this {
    return this;
  }
  logString(): string {
    let mainPosition = this.sourcePosition;
    let mergePos = this.nodeSourcePosition(this.mergedDecl);
    let omitMergeFile = mainPosition && mergePos && mainPosition.filename === mergePos.filename;
    let mergeStr = `${this.declString(this.mergedSel, this.mergedDecl)} (at ${this.positionString(mergePos, omitMergeFile)})`;
    let unmergedPos = this.nodeSourcePosition(this.unmergedDecl);
    let omitUnmergedFile = mainPosition && unmergedPos && mainPosition.filename === unmergedPos.filename;
    let unmergedStr = `${this.declString(this.unmergedSel, this.unmergedDecl)} (at ${this.positionString(unmergedPos, omitUnmergedFile)})`;
    let conflictStr = this.declString(this.conflictSel, this.conflictDecl);
    let elStr = this.elementString();
    return this.annotateLogMessage(
      `Couldn't merge ${unmergedStr} with ${mergeStr} because it conflicts with ${conflictStr} on element ${elStr}`);
  }

  elementString(element: Element = this.element) {
    let elStr = element.toString();
    let elPos = this.positionString(element.sourceLocation.start);
    if (elPos) {
      elStr += ` (at ${elPos})`;
    }
    return elStr;
  }

  declString(selector: ParsedSelector, decl: postcss.Declaration): string {
    return `${selector} { ${decl.prop}: ${decl.value}${decl.important ? " !important": ""}; }`;
  }
}
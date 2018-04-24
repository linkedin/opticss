import { Attr, Attribute, SerializedAttribute } from "./Attribute";
import { attrValues } from "./attrValues";
import { SourceLocation } from "./SourceLocation";
import { POSITION_UNKNOWN, SourcePosition } from "./SourceLocation";
import { SerializedTagname, Tag, Tagname } from "./Tagname";

export type Selectable = Element | Tag | Attr;

export interface ElementInfo<TagnameType = Tag, AttributeType = Attr> {
  sourceLocation?: SourceLocation;
  tagname: TagnameType;
  attributes: Array<AttributeType>;
  id?: string;
}

export type SerializedElementInfo = ElementInfo<SerializedTagname, SerializedAttribute>;

export class Element implements ElementInfo {
  sourceLocation: SourceLocation;
  tagname: Tag;
  attributes: Array<Attr>;
  id: string | undefined;
  constructor(tagname: Tag, attributes: Array<Attr>, sourceLocation?: SourceLocation, id?: string) {
    this.tagname = tagname;
    this.attributes = attributes;
    this.sourceLocation = sourceLocation || {start: POSITION_UNKNOWN};
    this.id = id;
  }

  static fromElementInfo(info: ElementInfo): Element {
    return new Element(info.tagname, info.attributes, info.sourceLocation, info.id);
  }

  serialize(): SerializedElementInfo {
    let e: SerializedElementInfo = {
      tagname: this.tagname.toJSON(),
      attributes: this.attributes.map(a => a.toJSON()),
    };
    if (this.sourceLocation && this.sourceLocation.start.line >= 0) {
      e.sourceLocation = this.sourceLocation;
    }
    return e;
  }
  toString() {
    let parts = [];
    parts.push(this.tagname);
    for (let attr of this.attributes) {
      parts.push(attr);
    }
    return `<${parts.join(" ")}>`;
  }
}

/**
 * Returns an unknown element. Use of this element in an analysis
 * has the effect of putting the optimizer into a conservative optimization
 * mode since there's no longer any guarantees about what values maybe be
 * correlated on the element's attributes. Essentially, every selector will
 * match this element.
 *
 * @param [unknownAttrs=["class", "id"]] Which attributes should be marked as unknown.
 * @param [startPosition] if the start position is known it can be provided.
 * @param [endPosition] if the end position is known it can be provided.
 */
export function unknownElement(unknownAttrs = ["class", "id"], startPosition?: SourcePosition, endPosition?: SourcePosition): Element {
  let tagname = new Tagname(attrValues.unknown());
  let attrs = new Array<Attribute>();
  for (let attrName of unknownAttrs) {
    attrs.push(new Attribute(attrName, attrValues.unknown()));
  }
  let loc: SourceLocation | undefined = undefined;
  if (startPosition) {
    loc = {start: startPosition};
    if (endPosition) {
      loc.end = endPosition;
    }
  }
  return new Element(tagname, attrs, loc);
}

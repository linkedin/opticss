import { Attr, SerializedAttribute } from "./Attribute";
import { POSITION_UNKNOWN } from "./SourceLocation";
import { SerializedTagname, Tag } from "./Tagname";
import { SourceLocation } from "./index";

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

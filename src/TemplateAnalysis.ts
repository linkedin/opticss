import { TagnameBase, AttributeBase, SerializedTagname, SerializedAttribute } from "./Styleable";
import { SerializedTemplateInfo, TemplateTypes, TemplateInfoFactory } from "./TemplateInfo";
import * as errors from "./errors";

export interface SourcePosition {
  line: number;
  column?: number;
}
export const POSITION_UNKNOWN: SourcePosition = { line: -1 };

export interface SourceLocation {
  start: SourcePosition;
  end?: SourcePosition;
}
export interface ElementInfo<TagnameType = TagnameBase, AttributeType = AttributeBase> {
  sourceLocation?: SourceLocation;
  tagname: TagnameType;
  attributes: Array<AttributeType>;
}

export type SerializedElementInfo = ElementInfo<SerializedTagname, SerializedAttribute>;

/*
 * This interface defines a JSON friendly serialization
 * of a {TemplateAnalysis}.
 */
export interface SerializedTemplateAnalysis<K extends keyof TemplateTypes> {
  template: SerializedTemplateInfo<K>;
  elements: SerializedElementInfo[];
}

/**
 * A TemplateAnalysis tracks style-relevant markup information on elements. The
 * goal of this analysis is to provide information necessary to prove that two
 * selectors that set the same css property but to different values never
 * target the same html element. However, it's very hard to prove a negative,
 * so instead we use the analysis to decide whether there is an element that
 * two conflicting selectors may match. If no such element is found in the
 * analysis, we assume it doesn't exist.
 *
 * This class can be used while traversing a document or template AST to record
 * the style-relevant markup information.
 *
 * It also provides effecienty querying to decide if two selectors' key
 * selector might match the same element. This analysis information makes no
 * attempt at recording the hierchical information of a document. Hierarchy
 * infomation is deemed unreliable to determine statically. We may revisit
 * hierarchical analysis in the future.
 *
 * 1. Call [[startElement startElement(tagname)]] at the beginning of an new html element.
 * 2. Call [[addAttribute addAttribute(attribute)]] for all the style-relevant attributes used on the current html element.
 * 3. Call [[endElement endElement()]] when done adding attributes for the current element.
 */
export class TemplateAnalysis<K extends keyof TemplateTypes> {

  template: TemplateTypes[K];

  /**
   * A list of all the styles that are used together on the same element.
   * The current correlation is added to this list when [[endElement]] is called.
   */
  elements: ElementInfo[];

  /**
   * The current element is created when calling [[startElement]].
   * The current element is unset after calling [[endElement]].
   */
  currentElement?: ElementInfo;

  /**
   * @param template The template being analyzed.
   */
  constructor(template: TemplateTypes[K]) {
    this.template = template;
    this.elements = [];
  }

  /**
   * Indicates a new element found in a template.
   *
   * If for some reason the code can't know the source position,
   * you should pass the `POSITION_UNKNOWN` constant value.
   *
   * Allways call [[endElement]] before calling the next [[startElement]],
   * even if the elements are nested in the document.
   */
  startElement(tagname: TagnameBase, position: SourcePosition ): this {
    if (this.currentElement) {
       throw new errors.OpticssError(`endElement wasn't called after a previous call to startElement`,
                                     {filename: this.template.identifier, ...position});
    }
    this.currentElement = {
      tagname,
      attributes: new Array<AttributeBase>(),
    };
    if (position.line >= 0) {
      this.currentElement.sourceLocation = {start: position};
    }
    return this;
  }

  /**
   * Add an attribute. Dynamic values are handled according to the value that is
   * given to the attribute. For instance imagine an element:
   * `<div class="class1 $foo class3 $($cond ? 'class4' : 'class5') size-$size">`
   *
   * Depending on what the analyzer can deduce about the dynamic values this could
   * end up represented by several different values.
   *
   * If the analyzer has no idea what `$foo` might be, then the value for this
   * attribute should simply be `{unknown: true}` because if any number of
   * class could be returned then there's no benefit to providing information
   * about the other classes from the optimizers perspective. If however,
   * there's a way of knowing that the unknown value is limited to a single
   * identifier, then there is some marginal value in recording it using the
   * `{unknownIdentifier: true}` value -- especially if it's used in a way where
   * it would be the only class, that's enough information to know that two
   * different classes won't conflict.
   *
   * Let's assume that the analyzer was able to determine that $foo is a class `class2`
   * but that sometimes it's not set. In this case we'd set the value to:
   *
   * ```
   * {
   *   allOf: [
   *     {value: "class1"},    // class1
   *     {oneOf: [             // $foo
   *       {absent: true},
   *       {value: "class2"}
   *     ]}
   *     {value: "class3"},    // class3
   *     {oneOf: [             // $($cond ? 'class4' : 'class5')
   *       {value: "class4"},
   *       {value: "class5"}
   *     ]}
   *     {startsWith: "size-", // size-$size
   *      whitespace: false}
   *   ]
   * }
   * ```
   *
   * Especially for the class attribute, even one html element with an unknown
   * value or two unknown identifiers will have detrimental effects on the
   * ability to optimize the entire stylesheet.
   */
  addAttribute(attr: AttributeBase): this {
    if (this.currentElement) {
      this.currentElement.attributes.push(attr);
    } else {
       throw new errors.OpticssError(`startElement() must be called before calling addAttribute()`,
                                     {filename: this.template.identifier});
    }

    return this;
  }

  /**
   * Indicates all styles for the element have been found.
   *
   * If for some reason the code can't know the source position,
   * you should pass the `POSITION_UNKNOWN` constant value.
   *
   */
  endElement(position?: SourcePosition): this {
    if (this.currentElement) {
      if (this.currentElement.sourceLocation && position && position.line >= 0) {
        this.currentElement.sourceLocation.end = position;
      }
      this.elements.push(this.currentElement);
      this.currentElement = undefined;
    }
    return this;
  }

  /**
   * Generates a [[SerializedTemplateAnalysis]] for this analysis.
   */
  serialize(): SerializedTemplateAnalysis<K> {
    let elements = new Array<SerializedElementInfo>();
    this.elements.forEach((element) => {
      let e: SerializedElementInfo = {
        tagname: element.tagname.toJSON(),
        attributes: element.attributes.map(a => a.toJSON())
      };
      if (element.sourceLocation) {
        e.sourceLocation = element.sourceLocation;
      }
      elements.push(e);
    });
    return {
      template: this.template.serialize() as SerializedTemplateInfo<K>,
      elements,
    };
  }

  /**
   * Creates a TemplateAnalysis from its serialized form.
   * @param serializedAnalysis The analysis to be recreated.
   * @param options The plugin options that are used to parse the blocks.
   * @param postcssImpl The instance of postcss that should be used to parse the block's css.
   */
  static deserialize<K extends keyof TemplateTypes>(serializedAnalysis: SerializedTemplateAnalysis<K>): TemplateAnalysis<K> {
    let template = TemplateInfoFactory.deserialize<K>(serializedAnalysis.template);
    let analysis = new TemplateAnalysis<K>(template);
    serializedAnalysis.elements.forEach(element => {
      analysis.startElement(TagnameBase.fromJSON(element.tagname), element.sourceLocation && element.sourceLocation.start || POSITION_UNKNOWN);
      element.attributes.forEach(attribute => {
        analysis.addAttribute(AttributeBase.fromJSON(attribute));
      });
      analysis.endElement(element.sourceLocation && element.sourceLocation.end || POSITION_UNKNOWN);
    });
    return analysis;
  }
}
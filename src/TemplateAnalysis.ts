import { TagnameBase, AttributeBase } from "./Styleable";

export interface StyleCorrelation {
  tagname: TagnameBase;
  attributes: Array<AttributeBase>;
}

export class TemplateAnalysis {
  /**
   * Document traits that appear together that might have associated styles.
   */
  styleCorrelations: StyleCorrelation[];
  constructor() {
    this.styleCorrelations = [];
  }
  addCorrelation(tagname: TagnameBase, ...attributes: AttributeBase[]) {
    this.styleCorrelations.push({ tagname, attributes });
  }
}
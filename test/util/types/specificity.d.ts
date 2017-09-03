declare module "specificity" {
  export = specificity;
  namespace specificity {
    enum ArrayIndex {
      importants,
      ids,
      classes,
      elements
    }
    enum SpecificityType {
      ids = "a",
      classes = "b",
      elements = "c"
    }
    type SpecificityArray = [number, number, number, number];
    interface Part {
      selector: string;
      type: SpecificityType;
      index: number;
      length: number;
    }
    interface Specificity {
      selector: string;
      specificity: string;
      specificityArray: SpecificityArray;
      parts: Array<Part>;
    }
    function calculate(selector: string): Array<Specificity>;
    function compare(a: string | SpecificityArray, b: string | SpecificityArray): -1 | 0 | 1;
  }
}
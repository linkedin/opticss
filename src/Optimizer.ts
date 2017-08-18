import { CssFile, ParsedCssFile } from "./CssFile";
import { StyleMapping } from "./StyleMapping";
import { OpticssOptions, DEFAULT_OPTIONS } from "./OpticssOptions";
import { TemplateAnalysis } from "./TemplateAnalysis";
import { TemplateTypes } from "./TemplateInfo";
import * as postcss from "postcss";
import * as concat from "concat-with-sourcemaps";

export interface OptimizationResult {
  output: CssFile;
  styleMapping: StyleMapping;
}

export class Optimizer {
  /**
   * CSS Sources to be optimized.
   */
  sources: Array<CssFile>;

  analyses: Array<TemplateAnalysis<keyof TemplateTypes>>;

  options: OpticssOptions;

  /**
   * Creates a new OptiCSS Optimizer.
   *
   * @param {Array<CssFile>} sources a list of css files to be optimized.
   *   within a given css file, the cascade is respected as a conflict resolution
   *   signal. Classes from multiple files are assumed to have an arbitrary ordering
   *   and the cascade is not used to resolve conflicts between properties. Instead,
   *   those conflicts must be resolvable by having analysis information that proves
   *   they don't conflict or by having selectors that unambiguously resolve the conflict.
   */
  constructor(options: Partial<OpticssOptions>) {
    this.sources = [];
    this.analyses = [];
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
  }

  addSource(file: CssFile) {
    this.sources.push(file);
  }

  addAnalysis(analysis: TemplateAnalysis<keyof TemplateTypes>) {
    this.analyses.push(analysis);
  }

  private optimizeSingleFile(_styleMapping: StyleMapping, source: CssFile): Promise<ParsedCssFile> {
    return parseCss(source).then(file => {
      return file;
    });
  }

  private optimizeAllFiles(files: Array<ParsedCssFile>): Promise<Array<ParsedCssFile>> {
    return Promise.resolve(files);
  }

  optimize(outputFilename: string): Promise<OptimizationResult> {
    let styleMapping = new StyleMapping();
    let promises = this.sources.map(source => this.optimizeSingleFile(styleMapping, source));

    return Promise.all(promises).then(files => {
      return this.optimizeAllFiles(files);
    }).then((files) => {
      let output = new concat.Concat(true, outputFilename, "\n");
      files.forEach(file => {
        output.add(file.filename || "optimized.css", file.content.css, file.content.map && file.content.map.toJSON());
      });
      return {
        output: {
          content: output.content.toString(),
          sourceMap: output.sourceMap,
          filename: outputFilename
        },
        styleMapping
      };
    });
  }
}

function parseCss(file: CssFile): Promise<ParsedCssFile> {
  if (typeof file.content === "string") {
    return new Promise<postcss.Result>((resolve, reject) => {
      // TODO get the source map passed in if there is one.
      postcss().process(file.content, {from: file.filename}).then(resolve, reject);
    }).then(result => {
      return {
        content: result,
        filename: file.filename
      };
    });
  } else {
    return Promise.resolve(<ParsedCssFile>file);
  }
}
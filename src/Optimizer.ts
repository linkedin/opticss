import { CssFile, ParsedCssFile } from "./CssFile";
import { StyleMapping } from "./StyleMapping";
import { OptiCSSOptions, DEFAULT_OPTIONS, TemplateIntegrationOptions } from "./OpticssOptions";
import { TemplateAnalysis } from "./TemplateAnalysis";
import { TemplateTypes } from "./TemplateInfo";
import { optimizations, Optimization, SingleFileOptimization, MultiFileOptimization } from "./optimizations";
import * as postcss from "postcss";
import Concat = require("concat-with-sourcemaps");
import { SelectorCache } from "./query";
import { Actions } from "./Actions";
import { IdentGenerators } from "./util/IdentGenerator";

export interface OptimizationResult {
  output: CssFile;
  styleMapping: StyleMapping;
  actions: Actions;
}

function optimizesSingleFiles(optimization: Optimization): optimization is SingleFileOptimization {
  if ((<SingleFileOptimization>optimization).optimizeSingleFile) {
    return true;
  } else {
    return false;
  }
}

function optimizesAllFiles(optimization: Optimization): optimization is MultiFileOptimization {
  if ((<MultiFileOptimization>optimization).optimizeAllFiles) {
    return true;
  } else {
    return false;
  }
}

export class OptimizationPass {
  styleMapping: StyleMapping;
  cache: SelectorCache;
  actions: Actions;
  identGenerators: IdentGenerators<"id" | "class">;
  constructor() {
    this.styleMapping = new StyleMapping();
    this.cache = new SelectorCache();
    this.actions = new Actions();
    this.identGenerators = new IdentGenerators("id", "class");
  }
}

export class Optimizer {
  /**
   * CSS Sources to be optimized.
   */
  sources: Array<CssFile>;

  analyses: Array<TemplateAnalysis<keyof TemplateTypes>>;

  options: OptiCSSOptions;
  templateOptions: TemplateIntegrationOptions;

  private singleFileOptimizations: Array<SingleFileOptimization>;
  private multiFileOptimizations: Array<MultiFileOptimization>;

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
  constructor(options: Partial<OptiCSSOptions>, templateOptions: TemplateIntegrationOptions) {
    this.sources = [];
    this.analyses = [];
    // TODO: give an error if the options conflict with the template integration abilities?
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    this.templateOptions = templateOptions;
    this.singleFileOptimizations = [];
    this.multiFileOptimizations = [];
    if (!this.options.enabled) {
      return;
    }
    Object.keys(optimizations).forEach(opt => {
      console.log(opt);
      // TODO using any here because of a typescript type resolution bug of some sort.
      if (this.options.only && this.options.only.indexOf(<any>opt) === -1) {
        return;
      }
      if (this.options.except && this.options.except.indexOf(<any>opt) >= 0) {
        return;
      }
      if (this.options[opt]) {
        let Optimization = optimizations[opt];
        let optimization = new Optimization(this.options, this.templateOptions);
        if (optimizesSingleFiles(optimization)) {
          this.singleFileOptimizations.push(optimization);
        }
        if (optimizesAllFiles(optimization)) {
          this.multiFileOptimizations.push(optimization);
        }
      }
    });
  }

  addSource(file: CssFile) {
    this.sources.push(file);
  }

  addAnalysis(analysis: TemplateAnalysis<keyof TemplateTypes>) {
    this.analyses.push(analysis);
  }

  private optimizeSingleFile(pass: OptimizationPass, source: CssFile): Promise<ParsedCssFile> {
    return parseCss(source).then(file => {
      this.singleFileOptimizations.forEach((optimization) => {
        optimization.optimizeSingleFile(pass, this.analyses, file);
      });
      return file;
    });
  }

  private optimizeAllFiles(pass: OptimizationPass, files: Array<ParsedCssFile>): Promise<Array<ParsedCssFile>> {
    this.multiFileOptimizations.forEach((optimization) => {
      optimization.optimizeAllFiles(pass, this.analyses, files);
    });
    return Promise.resolve(files);
  }

  optimize(outputFilename: string): Promise<OptimizationResult> {
    let pass = new OptimizationPass();
    let promises = this.sources.map(source => this.optimizeSingleFile(pass, source));

    return Promise.all(promises).then(files => {
      return this.optimizeAllFiles(pass, files);
    }).then((files) => {
      let output = new Concat(true, outputFilename, "\n");
      files.forEach(file => {
        let resultOpts = {
          to: outputFilename,
          map: {
            inline: false,
            prev: file.content.map,
            sourcesContent: true,
            annotation: false
          }
        };
        let result = file.content.root!.toResult(resultOpts);
        output.add(file.filename || "optimized.css", result.css, result.map.toJSON());
      });
      return {
        output: {
          content: output.content.toString(),
          sourceMap: output.sourceMap,
          filename: outputFilename
        },
        styleMapping: pass.styleMapping,
        actions: pass.actions
      };
    });
  }
}

function parseCss(file: CssFile): Promise<ParsedCssFile> {
  if (typeof file.content === "string") {
    return new Promise<postcss.Result>((resolve, reject) => {
      let sourceMapOptions = {
        inline: false,
        prev: file.sourceMap,
        sourcesContent: true,
        annotation: false
      };
      let processOpts = {
        from: file.filename,
        map: sourceMapOptions
      };
      postcss().process(file.content, processOpts).then(resolve, reject);
    }).then(result => {
      return {
        content: result,
        filename: file.filename,
      };
    });
  } else {
    return Promise.resolve(<ParsedCssFile>file);
  }
}
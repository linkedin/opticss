import { CssFile, ParsedCssFile } from "./CssFile";
import { StyleMapping } from "./StyleMapping";
import { OptiCSSOptions, DEFAULT_OPTIONS, TemplateIntegrationOptions } from "./OpticssOptions";
import { TemplateAnalysis } from "./TemplateAnalysis";
import { TemplateTypes } from "./TemplateInfo";
import { optimizations, Optimization, SingleFileOptimization, MultiFileOptimization } from "./optimizations";
import * as postcss from "postcss";
import Concat = require("concat-with-sourcemaps");
import { Actions } from "./Actions";
import { OptimizationPass } from "./OptimizationPass";
import initializers, { Initializers } from "./initializers";

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
  private initializers: Array<keyof Initializers>;

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
    this.initializers = new Array<keyof Initializers>();
    if (!this.options.enabled) {
      return;
    }
    Object.keys(optimizations).forEach(opt => {
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
        for (let initializerName of optimization.initializers) {
          if (!this.initializers.includes(initializerName)) {
            this.initializers.push(initializerName);
          }
        }
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

  private initialize(pass: OptimizationPass, files: Array<ParsedCssFile>) {
    this.initializers.forEach(initializerName => {
      initializers[initializerName](pass, this.analyses, files, this.options, this.templateOptions);
    });
  }

  private parseFiles(sources: Array<CssFile>): Promise<Array<ParsedCssFile>> {
    let promises = new Array<Promise<ParsedCssFile>>();
    for (let source of sources) {
      promises.push(parseCss(source));
    }
    return Promise.all(promises);
  }

  private optimizeSingleFile(pass: OptimizationPass, file: ParsedCssFile): Promise<ParsedCssFile> {
    this.singleFileOptimizations.forEach((optimization) => {
      optimization.optimizeSingleFile(pass, this.analyses, file);
    });
    return Promise.resolve(file);
  }

  private optimizeAllFiles(pass: OptimizationPass, files: Array<ParsedCssFile>): Promise<Array<ParsedCssFile>> {
    this.multiFileOptimizations.forEach((optimization) => {
      optimization.optimizeAllFiles(pass, this.analyses, files);
    });
    return Promise.resolve(files);
  }

  optimize(outputFilename: string): Promise<OptimizationResult> {
    let pass = new OptimizationPass();
    return this.parseFiles(this.sources).then(parsedFiles => {
      this.initialize(pass, parsedFiles);
      return parsedFiles;
    }).then(parsedFiles => {
      return Promise.all(parsedFiles.map(cssFile => this.optimizeSingleFile(pass, cssFile)));
    }).then(files => {
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
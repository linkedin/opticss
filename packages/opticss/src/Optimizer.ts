import * as postcss from 'postcss';
import Concat = require('concat-with-sourcemaps');

import {
  Actions,
} from './Actions';
import {
  CssFile,
  ParsedCssFile,
} from './CssFile';
import {
  default as initializers,
  Initializers,
} from './initializers';
import {
  OptiCSSOptions,
  DEFAULT_OPTIONS,
} from './OpticssOptions';
import {
  isMultiFileOptimization,
  isSingleFileOptimization,
  Optimization,
  optimizations,
} from './optimizations';
import {
  StyleMapping,
  TemplateAnalysis,
  TemplateTypes,
  TemplateIntegrationOptions,
  normalizeTemplateOptions,
} from '@opticss/template-api';
import { OptimizationPass } from './OptimizationPass';

export interface OptimizationResult {
  output: CssFile;
  styleMapping: StyleMapping;
  actions: Actions;
}

export interface TimingData {
  [optimization: string]: number;
}

export class Optimizer {
  /**
   * CSS Sources to be optimized.
   */
  sources: Array<CssFile>;

  analyses: Array<TemplateAnalysis<keyof TemplateTypes>>;

  options: OptiCSSOptions;
  templateOptions: TemplateIntegrationOptions;
  timings: TimingData;

  private optimizations: Array<Optimization>;
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
  constructor(options: Partial<OptiCSSOptions>, templateOptions: Partial<TemplateIntegrationOptions>) {
    this.sources = [];
    this.analyses = [];
    // TODO: give an error if the options conflict with the template integration abilities?
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    this.templateOptions = normalizeTemplateOptions(templateOptions);
    this.optimizations = [];
    this.timings = {};
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
        this.optimizations.push(optimization);
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

  private optimizeFiles(pass: OptimizationPass, files: Array<ParsedCssFile>): Promise<Array<ParsedCssFile>> {
    for (let optimization of this.optimizations) {
      let start = new Date();
      if (isSingleFileOptimization(optimization)) {
        for (let file of files) {
          optimization.optimizeSingleFile(pass, this.analyses, file);
        }
      }
      if (isMultiFileOptimization(optimization)) {
        optimization.optimizeAllFiles(pass, this.analyses, files);
      }
      let end = new Date();
      this.timings[optimization.name] = end.getUTCMilliseconds() - start.getUTCMilliseconds();
    }
    return Promise.resolve(files);
  }

  private concatenateFiles(files: Array<ParsedCssFile>, outputFilename: string): Concat {
    let output = new Concat(true, outputFilename, "\n");
    for (let file of files) {
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
    }
    return output;
  }

  optimize(outputFilename: string): Promise<OptimizationResult> {
    let pass = new OptimizationPass(this.templateOptions);
    return this.parseFiles(this.sources).then(parsedFiles => {
      this.initialize(pass, parsedFiles);
      return parsedFiles;
    }).then(files => {
      return this.optimizeFiles(pass, files);
    }).then((files) => {
      let output = this.concatenateFiles(files, outputFilename);
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
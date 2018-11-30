import {
  StyleMapping,
  TemplateAnalysis,
  TemplateIntegrationOptions,
  TemplateTypes,
  normalizeTemplateOptions,
} from "@opticss/template-api";
import Concat = require("concat-with-sourcemaps");
import * as postcss from "postcss";

import { Actions } from "./Actions";
import { CssFile, ParsedCssFile } from "./CssFile";
import { Initializers, initializers } from "./initializers";
import { DEFAULT_OPTIONS, OptiCSSOptions } from "./OpticssOptions";
import { OptimizationPass } from "./OptimizationPass";
import {
  Optimization,
  isMultiFileOptimization,
  isSingleFileOptimization,
  optimizations,
} from "./optimizations";

export interface OptimizationResult {
  output: CssFile;
  styleMapping: StyleMapping;
  actions: Actions;
}

export interface TimingData {
  [timingName: string]: {
    start: number;
    end: number;
  };
}

export class Optimizer {

  // CSS Sources and TemplateAnalyses to use in this optimization.
  sources: Array<CssFile>;
  analyses: Array<TemplateAnalysis<keyof TemplateTypes>>;

  options: OptiCSSOptions;
  templateOptions: TemplateIntegrationOptions;

  // Timing data from each optimization step stored here.
  timings: TimingData;

  // Initializers and optimizations allowed by template and app options loaded here in the constructor.
  private initializers: Set<keyof Initializers>;
  private optimizations: Set<Optimization>;

  /**
   * Creates a new OptiCSS Optimizer.
   *
   * @param sources a list of css files to be optimized.
   *   within a given css file, the cascade is respected as a conflict resolution
   *   signal. Classes from multiple files are assumed to have an arbitrary ordering
   *   and the cascade is not used to resolve conflicts between properties. Instead,
   *   those conflicts must be resolvable by having analysis information that proves
   *   they don't conflict or by having selectors that unambiguously resolve the conflict.
   */
  constructor(options: Partial<OptiCSSOptions>, templateOptions: Partial<TemplateIntegrationOptions>) {

    // TODO: Remove April 2019 when Node.js 6 is EOL'd
    if (parseInt(process.versions.node) <= 6) {
      throw new Error("Opticss does not support Node.js <= 6");
    }

    this.sources = [];
    this.analyses = [];
    // TODO: give an error if the options conflict with the template integration abilities?
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    this.templateOptions = normalizeTemplateOptions(templateOptions);
    this.optimizations = new Set();
    this.initializers = new Set();
    this.timings = {};

    // If disabled, short circuit.
    if (!this.options.enabled) { return; }

    // Load all Initializers and optimizations alloed by template and app options.
    let only: string[] = this.options.only || [];
    let except: string[] = this.options.except || [];
    Object.keys(optimizations).forEach(opt => {

      // If optimization is excluded by the `only` or `except` options, skip it.
      if ((only.length && !only.includes(opt)) || (except.length && except.includes(opt))) { return; }

      // If this optimization is included by config, add it and its initializers to our list.
      if (this.options[opt]) {
        let optimization = new optimizations[opt](this.options, this.templateOptions);
        this.optimizations.add(optimization);
        for (let initializerName of optimization.initializers) {
          this.initializers.add(initializerName);
        }
      }
    });
  }

  /**
   * Add another source file to include in this optimization.
   * @param CSS File to add
   */
  addSource(file: CssFile) {
    this.sources.push(file);
  }

  /**
   * Add another TemplateAnalysis to use in this optimization.
   * @param TemplateAnalysis to use.
   */
  addAnalysis(analysis: TemplateAnalysis<keyof TemplateTypes>) {
    this.analyses.push(analysis);
  }

  /**
   * Utility method to save timing data.
   * @param Timing measurement name.
   * @param Timing measurement start.
   * @param Timing measurement end.
   */
  private logTiming(name: string, start: Date, end: Date) {
    this.timings[name] = {
      start: start.getUTCMilliseconds(),
      end: end.getUTCMilliseconds(),
    };
  }

  /**
   * Parse all CSS files this optimizer is concerned with.
   * @param All sources registered with this Optimizer.
   * @returns All files we're working on, now represented as postcss trees.
   */
  private parseFiles(sources: Array<CssFile>): Promise<Array<ParsedCssFile>> {
    let start = new Date();
    let promises = new Array<Promise<ParsedCssFile>>();
    for (let source of sources) {
      promises.push(parseCss(source));
    }
    return Promise.all(promises).then((res) => {
      this.logTiming("parse", start, new Date());
      return res;
    });
  }

  /**
   * Run all optimizations' initializers.
   * @param This optimization pass instance.
   * @param All files we're working on, parsed as postcss trees.
   */
  private initialize(pass: OptimizationPass, files: Array<ParsedCssFile>) {
    let start = new Date();
    this.initializers.forEach(initializerName => {
      initializers[initializerName](pass, this.analyses, files, this.options, this.templateOptions);
    });
    this.logTiming("initialize", start, new Date());
  }

  /**
   * Run all of this optimizer's optimizations.
   * @param This optimization pass instance.
   * @param All files we're working on, parsed as postcss trees.
   * @returns All the files we're just transformed.
   */
  private optimizeFiles(pass: OptimizationPass, files: Array<ParsedCssFile>): Promise<Array<ParsedCssFile>> {
    let begin = new Date();
    this.optimizations.forEach((optimization) => {
      let start = new Date();
      if (isSingleFileOptimization(optimization)) {
        for (let file of files) {
          optimization.optimizeSingleFile(pass, this.analyses, file);
        }
      }
      if (isMultiFileOptimization(optimization)) {
        optimization.optimizeAllFiles(pass, this.analyses, files);
      }
      this.logTiming(optimization.name, start, new Date());
    });
    this.logTiming("optimize", begin, new Date());
    return Promise.resolve(files);
  }

  /**
   * Concatenate all of this Optimizer's files into a single output.
   * @param All postcss ASTs we're working on.
   * @param The expected output's filename.
   * @returns The concatenated file.
   */
  private concatenateFiles(files: Array<ParsedCssFile>, outputFilename: string): Concat {
    let start = new Date();
    let output = new Concat(true, outputFilename, "\n");
    for (let file of files) {
      let resultOpts = {
        to: outputFilename,
        map: {
          inline: false,
          prev: file.content.map,
          sourcesContent: true,
          annotation: false,
        },
      };
      let result = file.content.root!.toResult(resultOpts);
      output.add(file.filename || "optimized-input.css", result.css, result.map.toJSON());
    }
    this.logTiming("concatenate", start, new Date());
    return output;
  }

  /**
   * Main runner method for the Optimizer. After all Sources and Analyses are registered,
   * calling this method executes all requested optimizations and returns an optimization result.
   * @param outputFilename - The output's filename. The file is not written
   *   but it is needed to ensure that source maps works correctly.
   * @returns The optimization result.
   */
  optimize(outputFilename: string): Promise<OptimizationResult> {
    let pass = new OptimizationPass(this.options, this.templateOptions);
    let start = new Date();

    // Parse all input files.
    return this.parseFiles(this.sources)

    // Run all initializers on parsed files.
    .then(files => {
      this.initialize(pass, files);
      return files;
    })

    // Run all optimizers on parsed files.
    .then(files => {
      return this.optimizeFiles(pass, files);
    })

    // Concatenate all files and return optimization result.
    .then((files) => {
      let output = this.concatenateFiles(files, outputFilename);
      this.logTiming("total", start, new Date());
      return {
        output: {
          filename: outputFilename,
          content: output.content.toString(),
          sourceMap: output.sourceMap,
        },
        styleMapping: pass.styleMapping,
        actions: pass.actions,
      };
    });

  }
}

  /**
   * Given a CssFile (contents represented as a string), return the ParsedCssFile (contents represented as a postcss AST.
   * @param Input CssFile.
   * @returns The ParsedCssFile.
   */
function parseCss(file: CssFile): Promise<ParsedCssFile> {
  if (typeof file.content === "string") {
    return new Promise<postcss.Result>((resolve, reject) => {
      let processOpts = {
        from: file.filename,
        map: {
          inline: false,
          prev: file.sourceMap,
          sourcesContent: true,
          annotation: false,
        },
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

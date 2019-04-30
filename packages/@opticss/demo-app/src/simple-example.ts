// This file is used in the OptiCSS README. If it requires changing, update the README too.
import { unknownElement } from "@opticss/element-analysis";
import { Template, TemplateAnalysis, TemplateIntegrationOptions } from "@opticss/template-api";
import * as fs from "fs";
import { OptiCSSOptions, Optimizer } from "opticss";

// App level control of enabled features, enabling a feature that
// the template integration doesn't support, has no effect.
const options: Partial<OptiCSSOptions> = {
  rewriteIdents: { id: false, class: true },
};

// This value usually comes from the template integration library.
const templateOptions: Partial<TemplateIntegrationOptions> = {
  rewriteIdents: { id: false, class: true },
  analyzedTagnames: true,
};

// A new optimizer instance is required for every optimization.
let opticss = new Optimizer(options, templateOptions);

// Usually the css file(s) being optimized come from a previous build step.
// So opticss supports input source maps to ensure that errors and debugging
// information is correctly reported.
let cssFile = "build/assets/myapp.css";
opticss.addSource({
  filename: cssFile,
  content: fs.readFileSync(cssFile, "utf-8"),
  sourceMap: fs.readFileSync(`${cssFile}.map`, "utf-8"),
});

// This example doesn't use an analyzer. Instead, we create an analysis that
// describes an "unknown template" about which nothing is known.
let analysis = new TemplateAnalysis(new Template("unknown.html"));
// Any element that is unknown tells the optimizer that it must assume
// that any two styles might be co-located on that element. This
// forces the optimizer to be extremely conservative with cascade changes.
analysis.elements.push(unknownElement());
opticss.addAnalysis(analysis);

// Perform the optimization and output the results.
let outputName = "build/assets/optimized.css";
// tslint:disable-next-line:no-floating-promises
opticss.optimize(outputName).then(result => {
  fs.writeFileSync(outputName, result.output.content.toString(), "utf-8");
  fs.writeFileSync(`${outputName}.log`, result.actions.logStrings().join("\n"), "utf-8");
  // Source map information with opticss is of dubious value because sourcemaps cannot
  // represent mutations that turn multiple source bytes into a single output byte.
  // So the source map will only surface (at most) one of the source bytes that caused
  // an output byte to exist. The log has more in-depth information about what mutations were
  // performed.
  if (result.output.sourceMap) {
    fs.writeFileSync(`${outputName}.map`, result.output.sourceMap, "utf-8");
  }
  // When integrating with template analysis we would pass the optimization
  // styleMapping result to the template rewriter.
  //let rewriteInfo = result.styleMapping;
});

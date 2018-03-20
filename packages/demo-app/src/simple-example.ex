import * as fs from "fs";
import { Optimizer, OptiCSSOptions } from "opticss";
import { TemplateIntegrationOptions } from "@opticss/template-api";
import { TemplateAnalysis, Template } from "@opticss/template-api";
import { unknownElement, Tagname, attrValues, POSITION_UNKNOWN, Class } from "@opticss/element-analysis";
// App level control of enabled features, enabling a feature that
// the template integration doesn't support, has no effect.
const options: Partial<OptiCSSOptions> = {
  rewriteIdents: { id: false, class: true }
};
// This value usually comes from the template integration library.
const templateOptions: Partial<TemplateIntegrationOptions> = {
  rewriteIdents: { id: false, class: true },
  analyzedTagnames: true
};
// A new optimizer instance is required for every optimization.
let opticss = new Optimizer(options, templateOptions);

// Usually the css file(s) being optimized come from a previous build step.
let cssFile = "build/assets/myapp.css";
opticss.addSource({
  filename: cssFile,
  content: fs.readFileSync(cssFile, "utf-8"),
  sourceMap: fs.readFileSync(`${cssFile}.map`, "utf-8") 
});

// Since we don't have an analyzer, we create an analysis that describes an
// "unknown template" about which nothing is known.
let analysis = new TemplateAnalysis(new Template("unknown.html"));
analysis.elements.push(unknownElement());
opticss.addAnalysis(analysis);

let outputName = "build/assets/optimized.css";
opticss.optimize(outputName).then(result => {
  fs.writeFileSync(outputName, result.output.content.toString(), "utf-8");
  fs.writeFileSync(`${outputName}.log`, result.actions.logStrings().join("\n"), "utf-8");
  // pass result.styleMapping to a template rewriter here.
});


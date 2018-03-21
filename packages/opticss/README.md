OptiCSS
=======

This is the core library for OptiCSS. It provides the optimizer itself.

A framework that is using OptiCSS to provide template analysis and rewriting, should need only depend directly on `@opticss/element-analysis` and `@opticss/template-api`, neither of which depend on this package.

This library should be a dependency of a build system integration or an app's direct dependency if the build integration code has a peerDependency on the optimizer.

OptiCSS is a library that other CSS frameworks and tooling can adopt. If you're an application developer
reading this, the best way to use OptiCSS is to adopt an OptiCSS enabled CSS framework.

Frameworks Integration with OptiCSS
-----------------------------------

Currently, the only CSS framework that uses OptiCSS is
[css-blocks](http://css-blocks.com/). The css-blocks framework provides
application integrations for Glimmer Applications, (some) Ember Applications,
React/Preact apps using webpack. More app framework integrations are on the way.

If you maintain a CSS framework or styling library, we're excited to help you
design a solution that can correctly analyze styles and safely integrate with this tool.

Running the Optimizer
---------------------

The optimizer takes as input one or more CSS files and one or template analyses.
As well as configuration that describes the capabilities of the template integration
and the features that the application wants enabled.

The optimizer runs asynchronously and when complete, provides optimized CSS, information
for debugging purposes, and metadata that directs the template integration on how to
rewrite the templates to use the new css selectors.

The following example demonstrates how to use the optimizer with a single CSS file
when no template analysis information is available.

```ts
import * as fs from "fs";
import { unknownElement } from "@opticss/element-analysis";
import { Template, TemplateAnalysis, TemplateIntegrationOptions } from "@opticss/template-api";
import { OptiCSSOptions, Optimizer } from "opticss";

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
// So opticss supports input source maps to ensure that errors and debugging
// information is correctly reported.
let cssFile = "build/assets/myapp.css";
opticss.addSource({
  filename: cssFile,
  content: fs.readFileSync(cssFile, "utf-8"),
  sourceMap: fs.readFileSync(`${cssFile}.map`, "utf-8") 
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
```

Combining OptiCSS with other CSS Processors
-------------------------------------------

OptiCSS takes CSS as input. It has a deep understanding of css selector
semantics and also about the syntax of CSS property values and how different
CSS properties conflict/override.

It is not only safe, but recommended to use a CSS minifier with OptiCSS.
OptiCSS approaches CSS optimization with a completely different approach.
Minification and compression are both important steps required to optimize
your styles for over-the-wire transfer.

Development with OptiCSS
------------------------

The nature of an optimizing compiler is that small changes to input can have
changes that affect styles across an application. During application
development, we recommend that OptiCSS is disabled so that re-build caching
is effective and to make it easier for developers to make sense of the styles
they see in their browser.

When disabled, opticss still runs, but it returns an identity mapping that
rewrites all styles such that they are left intact. This reduces some of the risk
inherent with running an different set of tools in development than in production.

If a template integration supports rewriting attributes that aren't the html
class attribute into class names, you may consider leaving that feature
enabled but setting the ident generator into dev mode (TODO: create a dev
mode for the ident generator.)

Browser Targeting
-----------------

In the future, OptiCSS is likely to accept [`browserlist`](https://github.com/ai/browserslist)
configuration so that it can make sense of how browser support affects resolutions and progressive enhancement. If you're creating a per-browser build right now, you should pre-process your css
and remove any unsupported css features and optimize each browser independently. Keep in mind that
this also implies that your templates will need to be rewritten differently for each browser.

Code Splitting
--------------

Code splitting is a technique used to deliver parts of an application independently from each other.
OptiCSS does not have any features to support code splitting at this time, but we have thought this
use case through and have solutions that should work well in mind and this is a feature that's on our
roadmap.

That said, CSS optimized with OptiCSS is so much smaller and faster that you may find that code-splitting
is less necessary than you think. 
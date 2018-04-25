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
and React/Preact apps using webpack. More application framework integrations are on the way.

If you maintain a CSS framework or styling library, we're excited to help you
design a solution that can correctly analyze styles and safely integrate with
this tool.

Running the Optimizer
---------------------

The optimizer takes as input one or more CSS files and one or template
analyses. As well as configuration that describes the capabilities of the
template integration and the features that the application wants enabled.

The optimizer runs asynchronously and when complete, provides optimized CSS,
information for debugging purposes, and metadata that directs the template
integration on how to rewrite the templates to use the new CSS selectors.

The following example demonstrates how to use the optimizer with a single CSS
file when no template analysis information is available.

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

// Usually the CSS file(s) being optimized come from a previous build step.
// So OptiCSS supports input source maps to ensure that errors and debugging
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
  // Source map information with OptiCSS is of dubious value because sourcemaps cannot
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

OptiCSS Configuration Options
-----------------------------

#### Enabling/Disabling Optimizations

An optimization can be disabled by setting the optimization to `false` in the configuration option.
If set to true, the optimization is enabled with its
default configuration. Some optimizations have an optimization-specific configuration that can be provided instead of setting it to `true`.

As a convenience, there are two configuration properties, `only` and `except`, that accept an array of
optimization names. When `only` is provided, only those
optimizations specified are ran, regardless of the
optimization's setting in base options object. When
`except` is provided, those optimizations are never ran. Should an optimization be found in both the `only`
and the `except` lists, the optimization is not ran.

The `enabled` configuration option is a boolean value that controls whether any optimizations are performed. When set to `false`, it is the same as specifying all optimizations to the `except` option. When set to true (the default), the normal configuration options for what optimizations to run are respected.

#### Optimizations:

* `"rewriteIdents"` - Convert identifiers into new identifiers in order to make them shorter and more compressible. Different namespaces will re-use the same identifiers. (Enabled by default)
* `"removeUnusedStyles"` - Remove selectors that are proven to not match any analyzed element. If the removed selector is the only remaining selector, the associated rule set is removed. (Enabled by default)
* `"mergeDeclarations"` - Remove declarations from rules if there are several with the same value that can be combined and generate a new selector for it.
Rewrite elements such that the new selector matches the element whenever the original selector would have matched (and with the same cascade resolution). (Enabled by default)
* More optimizations are planned...

#### Optimization specific options:

The `rewriteIdents` optimization is the only optimization that has it's own configuration options (so far). To specify a configuration, set `rewriteIdents` to an object with the following keys:

* `id` - whether the `id` attribute should be rewritten.
* `class` - whether the `class` attribute should be rewritten.
* `omitIdents` - (optional) An object that specifies identifiers that are reserved and should not be used by OptiCSS in a specific namespace. The object can have keys of `id` and `class` with the value being an array of reserved identifiers.

#### CSS Feature Support

The `css` configuration option can be set to an object that provides information about the CSS features and support that OptiCSS can expect.

The following CSS features are currently supported:

* `caseInsensitiveSelectors` - In older versions of CSS, id and class selectors were case insensitive. This continues to be true for pages that end up in "quirks mode". Setting this value to `true`, forces OptiCSS to assume that those identifiers are case insensitve. This forces the ident generator to use only lower case letters for identifiers which is not as compressible.

#### More About Configuration

The configuration options to OptiCSS are available as a strongly typed interface that can be found at [OpticssOptions.ts](./src/OpticssOptions.ts)

The analyzer/rewriter implementation must also tell OptiCSS about its capabilities. OptiCSS will not honor a user request to enable features that the rewrite configuration says it does not support. See the [template-api package](../template-api) in this repo for more information.

Combining OptiCSS with other CSS Processors
-------------------------------------------

OptiCSS takes CSS as input. It has a deep understanding of CSS selector
semantics and also about the syntax of CSS property values and how different
CSS properties conflict/override. Alternative syntaxes, future syntax,
and any other authoring conveniences of that sort should be processed into
to CSS a browser would understand before loading it into OptiCSS (input sourcemaps
are accepted).

Depending on how you it's being used (E.g. for per-browser builds), it may be
better to run tools like autoprefixer before optimization, but it should
also be safe to run it afterwards. In general, running tools that change
what CSS properties are present or what their values are in a meaningful way
should run before optimization.

It is not only safe, but recommended to use a CSS minifier with OptiCSS.
OptiCSS approaches CSS optimization with a completely different approach.
Minification and compression are both important steps when optimizing
your styles for over-the-wire transfer.

Configuring OptiCSS for Development
-----------------------------------

The nature of an optimizing compiler is that small changes to input can have
changes that affect how the computed style is assembled for many seemingly
unrelated elements across an application. During application development, we
recommend that OptiCSS is disabled so that re-build caching is effective and
to make it easier for developers to make sense of the styles they see in
their browser.

When disabled, OptiCSS still runs, but it returns an identity mapping that
rewrites all styles such that they are left intact. This reduces some of the risk
inherent with running an different set of tools in development than in production.

If a template integration supports rewriting selectors that target attributes
that aren't the html class attribute into class names, you may consider
leaving that feature enabled but setting the ident generator into dev mode

**(TODO: create a dev mode for the ident generator.)**

Browser Targeting
-----------------

In the future, OptiCSS is likely to accept [`browserlist`](https://github.com/ai/browserslist)
configuration so that it can make sense of how browser support affects resolutions and progressive enhancement. If you're creating a per-browser build right now, you should pre-process your CSS
and remove any unsupported CSS features and optimize each browser independently. Keep in mind that
this also implies that your templates will need to be rewritten differently for each browser.

Code Splitting
--------------

Code splitting is a technique used to deliver parts of an application independently from each other.
OptiCSS does not have any features to support code splitting at this time, but we have thought this
use case through and have solutions that should work well in mind and this is a feature that's on our
roadmap.

That said, CSS optimized with OptiCSS is so much smaller and faster that you may find that code-splitting
is less necessary than you think. 

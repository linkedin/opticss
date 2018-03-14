OptiCSS
=======

This is the core library for OptiCSS. It provides the optimizer itself.

A framework that is using OptiCSS to provide template analysis and rewriting, should need only depend directly on `@opticss/element-analysis` and `@opticss/template-api`, neither of which depend on this package.

This library should be a dependency of a build system integration or an app's direct dependency if the build integration code has a peerDependency on the optimizer.

Running the Optimizer
---------------------

```ts
import * as fs from "fs";
import { Optimizer, OptiCSSOptions } from "opticss";
import { TemplateIntegrationOptions } from "@opticss/template-api";
// App level control of enabled features, enabling a feature that
// the template integration doesn't support, has no effect.
const options: Partial<OptiCSSOptions> = {
  rewriteIdents: { id: false, class: true }
};
// This value usually comes from the template integration library.
const templateOptions: Partial<TemplateIntegrationOptions> = {
}
let opticss = new Optimizer(options, templateOptions);
opticss.addSource({
  content: fs.readFileSync()
})
```
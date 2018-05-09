OptiCSS
=======

[![Greenkeeper badge](https://badges.greenkeeper.io/linkedin/opticss.svg)](https://greenkeeper.io/)

### OptiCSS is a template-aware stylesheet optimizer.

Most developers don't use OptiCSS directly. You may be looking for a style framework that uses it:

* [CSS Blocks](http://css-blocks.com/)
* *Add your project to this list! We want to collaborate with you on adopting OptiCSS.*

Overall [architecture documentation](./docs/ARCHITECTURE.md).

This is a monorepo, there's different documentation available in the various packages:

### Public API & Libraries:

These packages are what we expect others to have dependencies on. We are careful about their public APIs and backwards compatibility.

* `opticss`: The core library containing the optimizer. [README](./packages/opticss/README.md)
* `template-api` - The template analysis API.
* `element-analysis`: The element analysis API.
* `resolve-cascade` - A library that produces a resolved cascade for CSS
  selectors against a DOM without using a browser. [README](./packages/resolve-cascade/README.md)
* `util` - Common utilities and data structures that we share across our project.

### Internal Dependencies:

These packages are extracted to allow them to be shared. You probably won't
need to depend on them. As long as the other packages in this monorepo
compile and pass tests we don't worry about backwards incompatibilty for
these.

* `simple-template` - A custom template language we use for testing OptiCSS.
* `attr-analysis-dsl` - A custom DSL for expressing attribute analysis succinctly.
* `code-style`: The coding styleguide and linters for OptiCSS. [README](./packages/@opticss/code-style/README.md)

### Miscellany
* `demo-app`: An interactive demo of OptiCSS.
Unix Compatibility Issues
-------------------------

`./node_modules/.bin/tsbuild` is in dos mode and gives a runtime error on mac:

```
env: node\r: No such file or directory
```

workaround: locally edit and change to unix newlines

`*.d.ts` files ambiently parsed?
--------------------------------

I see some `*.d.ts` files being parsed for files that are in my output directory when I run with `traceResolution` enabled. This may be the root cause of the `forceConsistentCasingInFileNames` issue?

From what I can, this file was never returned as a resolution for any previous module request.

I have the output dir listed in the `exclude` config.

When I run `yarn tsbuild packages/@opticss/attr-analysis-dsl` it parses 
`packages/@opticss/element-analysis/dist/src/index.d.ts` as the first mention of any `.d.ts` file from my projects.


Path problems from transitive dependencies?
-------------------------------------------

```
error TS6305: Output file '/Users/ceppstei/Work/sailfish/opticss/packages/@opticss/util/dist/dist/src/Maybe.d.ts' has not
been built from source file '/Users/ceppstei/Work/sailfish/opticss/packages/@opticss/util/dist/src/Maybe.d.ts'.
```

The path: `/Users/ceppstei/Work/sailfish/opticss/packages/@opticss/util/dist/dist` doesn't even exist on disk.


This is included from `packages/@opticss/attr-analysis-dsl` -> `packages/@opticss/element-analysis` -> `packages/@opticss/util`

running `yarn tsbuild packages/@opticss/attr-analysis-dsl` fails but `yarn tsbuild packages/@opticss/element-analysis` and `yarn tsbuild packages/@opticss/util` succeed.


Incompatibility with `forceConsistentCasingInFileNames` option?
---------------------------------------------------------------

`forceConsistentCasingInFileNames` seems to cause errors between `.d.ts` files and normal `.ts` files.

I get a lot of errors like:

error TS1149: File name '/Users/ceppstei/Work/sailfish/opticss/packages/@opticss/util/src/typedAssert.ts' differs from already included file name '/Users/ceppstei/Work/sailfish/opticss/packages/@opticss/util/dist/src/typedAssert.d.ts' only in casing.
error TS1149: File name '/Users/ceppstei/Work/sailfish/opticss/packages/@opticss/util/src/Maybe.ts' differs from already included file name '/Users/ceppstei/Work/sailfish/opticss/packages/@opticss/util/dist/src/Maybe.d.ts' only in casing.



tsconfig.json
-------------

In VS Code, the `"references"` property doesn't seem to be in the tsconfig schema: `Unknown compiler option 'references'.` Maybe vscode doesn't read this from the typescript project that I built, or maybe it's missing in the main typescript definition?

Requirements on `outDir` configuration
--------------------------------------

The setup I chose was different from what I see in the demo projects and in
typescript itself where the projects are writing into a common output directory
(and then I assume these are packaged and distributed as a single unit).

The layout I'm using is to keep each package separate (so they can be ran and
packaged for independent distribution).

```
/packages/<scope>/
↳ package-1
  ↳ package.json
  ↳ tsconfig.json
  ↳ src
  ↳ test
  ↳ dist  <--- output dir for `package-1`
    ↳ src
    ↳ test
↳ package-2
  ↳ package.json
  ↳ tsconfig.json
  ↳ src
  ↳ test
  ↳ dist  <--- output dir for `package-2`
    ↳ src
    ↳ test
```

With this configuration, the build for both projects will succeed but at runtime they fail
because paths like this:

```js
const src_1 = require("../../util/src");
```

would have had to been rewritten based on relative outDir configurations to work. E.g.:

```js
const src_1 = require("../../../util/dist/src");
```

If there is a requirement for a specific output layout, I think I should have got an error
when building with `tsbuild`.

But I'd rather there not be any such requirement on the output layout.

This bring me to a bigger issue though, which is that relative output paths don't work
for my project **at all**...


Monorepo semantics are not supported
------------------------------------

According to [this comment](https://github.com/Microsoft/TypeScript/issues/21180#issuecomment-358427014)
this solution exists to support monorepos. But I see major issues as I've
ported this project to `tsbuild`.

A monorepo has the notion that each package should be consumed via it's public
API,  The project reference approach right now uses relative paths into deep
locations within the package's main module.

So instead of references to the root directory of other projects and then
having to convert every import to use relative paths, it would feel more
natural I think to configuration the project references to be modules and to be
consumed solely through the package's public imports.

At the very least, I'd expect the compiled output to map the path to the
correct module name, but I don't see how that's possible given the current
design which expects that project references must [always be a relative
path][relpath_link] and I don't see how it can know what the publicly
addressable module name would be.

What I'd like to have is a way to specify that a reference to a module
is publicly addressable as an abstract identifier at runtime.

### `my-monorepo/packages/consumer-project`

`my-monorepo/packages/consumer-project/tsconfig.json`:

```json
{ {"compilerOptions": {
  references: [
    {"module": "consumed-project", "path": "../consumed-project"},
  ]
} } }
```

`my-monorepo/packages/consumer-project/src/index.ts`:

```ts
export * from "./localModule";
export * from "./moduleWithNestedReference";
```

`my-monorepo/packages/consumer-project/src/localModule.ts`:

```ts
import * as consumed from "consumed-project";
```

`my-monorepo/packages/consumer-project/src/localModule.ts`:

```ts
import * as consumed from "consumed-project";
```

`my-monorepo/packages/consumer-project/src/moduleWithNestedReference.ts`:

```ts
import * as consumed from "consumed-project/dist/someOptionalImport";
```


### `my-monorepo/packages/consumed-project`

`my-monorepo/packages/consumed-project/tsconfig.json`:

```json
{{"compilerOptions": {
  "outDir": "dist",
  "composite": true
}}}
```

`my-monorepo/packages/consumed-project/package.json`:

```json
{
  "name": "consumed-project",
  "version": "0.0.1",
  "types": "dist/index.d.ts"
}
```

`my-monorepo/packages/consumer-project/src/moduleWithNestedReference.ts`:

Current code for projects will be written with references to the output
location types. I think an important principle that the current design
adheres to is that the module import specifier is not mangled at runtime and
I like that principle. I also found that having to go through all my project
and change paths from absolute locations to relative was very painful. It
would be a nice thing if monorepo projects adopting `tsbuild` (or a
project-ref aware version of `tsc`) didn't have to update all their imports.


There's also a lot of value in having the authored syntax should be done
according to their published layout so the author experiences what external
developers would experience and have less confusion for people reading the
source but consuming the module as a standard npm dependency.

```ts
import * as consumed from "consumed-project/dist/someOptionalImport";
```

But reasonable people could decide that the published output paths are a
compiler resolution concern. If so, I'd suggest that typescript could have a
field in package.json similar to `outDir` that lets it resolve abstract paths
relative to a published project with `.d.ts` files so that everyone is still
working with the same cross-project module import specifiers.

```ts
import * as consumed from "consumed-project/someOptionalImport";
```

In this case, the typescript resolver would sort out that this refers to
`my-monorepo/packages/consumer-project/dist/someOptionalImport.d.ts` because
of the package.json config, and then use the project reference config to work
out that the source location is actually something like
`my-monorepo/packages/consumer-project/lib/someOptionalImport.ts

I'd argue that `typeRoot` is a good name for the directory where the types
directory would be specified.

`my-monorepo/packages/consumed-project/package.json`:

```json
{
  "name": "consumed-project",
  "version": "0.0.1",
  "types": "dist/index.d.ts",
  "typeRoot": "dist"
}
```

Note: it would be nice if `types` when set to a directory could be considered
the `typeRoot` and default to loading `index.d.ts` in that directory, but I
think this has some backwards compatible issues if people are using a new
version of typescript with a published project that has a type file that is
in a subdirectory of the types. (at the very least a fallback behavior of
using the project's root directory would be required -- but that still fails
if there's a file of the same name in both directories
:face_with_rolling_eyes:). It's all very edge-casey, but at this point,
someone has probably done it. Still, the ongoing DX of making types set to a
directory Just Work™ that it's worth it to break a few edge-case projects
(could be analyzed from published projects in @types or on npm in general)

I don't know all the module systems that typescript supports or how those interact with
this feature, but for npm/cjs I'd really like for the path to the composite project
to be worked out by typescript using npm.

```json
{ {"compilerOptions": {
  references: [
    {"module": "consumed-project", "cjs": true},
  ]
} } }
```

In this case, the path for the project would be inferred from `package.json`
dependencies and npm-based resolution semantics. This would make working with
3rd-party dependencies really nice -- especially when doing one-off
development using `npm link` to fix a bug. It also makes adopting this
trivial for monorepos.


[relpath_link]: https://github.com/Microsoft/TypeScript/pull/22420/files#diff-c3ed224e4daa84352f7f1abcd23e8ccaR2223
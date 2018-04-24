import { whatever } from "@opticss/util";
export interface FeatureToggles {
  removeUnusedStyles: HTMLInputElement;
  // conflictResolution: HTMLInputElement;
  mergeDeclarations: HTMLInputElement;
  rewriteIdents: HTMLInputElement;
  rewriteIds: HTMLInputElement;
  analyzeForms: HTMLInputElement;
  analyzeIds: HTMLInputElement;
}

export type FeatureFlags = {
  [K in keyof FeatureToggles]: boolean;
};

export interface Demo {
  unlinkable?: boolean;
  name: string;
  css: string;
  template: string;
  options?: Partial<FeatureFlags>;
  default?: boolean;
}

export function hush(...objs: Array<whatever>) {
  if (!objs[0]) { return true; }
  return false;
}

export function loadDemos(): Array<Demo> {
  let demos = new Array<Demo>();
  // demos.push(defaultDemo());
  demos.push(breakCascadeDemo());
  demos.push(optimizationScopes());
  demos.push(formAnalysis());
  demos.push(idAnalysis());
  demos.push(progressiveEnhancement());
  demos.push(mergeComplexShorthand());
  return demos;
}

/*
function defaultDemo() {
  return {
    default: true,
    name: "Some colors.",
    css: `.bar {
  color: blue;
}
.foo {
  color: green;
}
.foo.bar {
  color: red;
}
`,
    template: `<div class="foo bar"></div>`
  };
}
*/

function breakCascadeDemo(): Demo {
  return {
    name: "Breaking the Cascade",
    css: `.orange { color: orange; }
.apple { color: red; }
.frozen { color: blue; }
.strawberry { color: red; }
`,
    template: `<div class="frozen orange"></div>
<div class="apple"></div>
<div class="strawberry"></div>
`,
    options: {
      rewriteIds: false,
      rewriteIdents: false,
    },
  };
}

function optimizationScopes(): Demo {
  return {
    name: "Optimization Scopes",
    css: `
.basic { color: red; }
.scoped .blue { color: blue; }
.scoped .y { color: blue; }
.scoped .z { color: blue; }
.scoped .basic { color: green; }

.sidebar { float: left; width: 20%; }
.footer { float: left; width: 100%; }
.content { float: left; clear: left; width: 80%%; }
.header { float: left; clear: left; width: 100%; }

@media all and (max-width: 400px) {
  .sidebar { float: none; width: 100%; }
  .footer { float: none; width: 100%; }
  .content { float: none; width: 100%; }
  .header { float: none; width: 100%; }
}

`.trim(),
    template: `
<div class="header"></div>
<article class="content">
  <h1 class="basic blue">Hi, Web Directions Summit!</h1>
  <div class="scoped">
    <h1 class="basic blue">Optimizers!</h1>
  </div>
</article>
<aside class="sidebar"></aside>
<nav class="footer"></div>
`.trim(),
    options: {
      removeUnusedStyles: false,
      rewriteIds: false,
      rewriteIdents: false,
    },
  };
}

function formAnalysis(): Demo {
  return {
    name: "Optimizing Forms",
    template: `
<div class="field">
  <label for="name-field" class="label">First Name:</label>
  <input id="name-field" type="text" disabled>
</div>`.trim(),

    css: `
.field { float: left; }
input[type=text] { float: left; }
input[disabled] { background-color: gray; }
.label { background-color: gray; }`.trim(),
    options: {
      analyzeForms: false,
    },
  };
}

function idAnalysis(): Demo {
  return {
    name: "Optimizing IDs",
    template: `
<div class="a">
  <span id="id1">id 1</span>
  <span id="id2">id 2</span>
  <span id="id3">id 3</span>
</div>
`.trim(),

    css: `
#id1 { color: blue; float: right; }
#id2 { color: blue; float: left; }
#id3 { color: blue; }
`.trim(),
    options: {
      analyzeIds: false,
    },
  };
}

function progressiveEnhancement(): Demo {
  return {
    name: "Progressive Enhancement",
    template: `
    <div class="duplicate-override"></div>
    <div class="duplicate-shorthand"></div>
    <div class="duplicate-longhand"></div>
    <div class="has-override"></div>
`.trim(),

    css: `
.duplicate-override {
  border-top-color: #ccc;
}
.duplicate-shorthand {
  border-top: 1px solid red;
}
.duplicate-longhand {
  border-top-color: red;
}
.has-override {
  /* progressive enhancement */
  border-top: 1px solid red;
  border-top-color: #ccc;
}
`.trim(),
    options: {
      analyzeIds: false,
    },
  };
}
function mergeComplexShorthand(): Demo {
  return {
    name: "Merge Complex Shorthands",
    template: `
`.trim(),

    css: `
.scope .b5 { background-position: center; }
.scope .b0 { background-image: none; }
.scope .b1 { background-repeat: repeat-x; }
.scope .b2 { background-repeat: repeat-x; }
.scope .b3 { background-clip: content-box; }
.scope .b4 { background-attachment: fixed; }
.scope .shBg, .shortBg { background: none center repeat-x fixed content-box red; }
.a0 { background-image: none; }
.a1 { background-repeat: repeat-x; }
.a2 { background-repeat: repeat-x; }
.a3 { background-clip: content-box; }
.a4 { background-attachment: fixed; }
/* remove the background-color */
.a5 { background-color: red; }
.a6 { background-position: center; }
.a7 { background-size: auto auto; }
.a8 { background-origin: content-box; }
`.trim(),
    options: {
      removeUnusedStyles: false,
      analyzeIds: false,
    },
  };
}

import { SimpleAnalyzer, SimpleTemplateRewriter, SimpleTemplateRunner, TestTemplate } from "../../simple-template/src";
import * as codemirror from "codemirror";
import * as csshint from "codemirror/addon/hint/css-hint";
import * as showhint from "codemirror/addon/hint/show-hint";
import * as cssmode from "codemirror/mode/css/css";
import * as htmlmode from "codemirror/mode/htmlmixed/htmlmixed";
import { Action, Optimizer, isMultiAction } from "../../../opticss/src";
import * as prettier from "prettier";
import * as Split from "split.js";

import { SizeResults, process as cssSize } from "./css-size-fake";
import { Demo, FeatureFlags, FeatureToggles, hush, loadDemos } from "./demos";

const FEATURE_TOGGLES: FeatureToggles = {
  removeUnusedStyles: (document.getElementById("removeUnusedStyles") as HTMLInputElement),
  // conflictResolution: (document.getElementById('conflictResolution') as HTMLInputElement),
  mergeDeclarations: (document.getElementById("mergeDeclarations") as HTMLInputElement),
  rewriteIdents: (document.getElementById("rewriteIdents") as HTMLInputElement),
  rewriteIds: (document.getElementById("rewriteIds") as HTMLInputElement),
  analyzeForms: (document.getElementById("analyzeForms") as HTMLInputElement),
  analyzeIds: (document.getElementById("analyzeIds") as HTMLInputElement),
};

const demoSelect = document.getElementById("demos") as HTMLSelectElement;

let defaultOptions = autoSaveOptions();
let [demos, defaultDemo] = initDemos(loadDemos(), defaultOptions);

// For the sake of typescript!
hush(cssmode, htmlmode, showhint, csshint);

Split(["#css-code-editor", "#tmpl-code-editor"], {
    sizes: [50, 50],
    minSize: 100,
    direction: "vertical",
    cursor: "row-resize",
});

Split(["#css-code-output", "#tmpl-code-output"], {
    sizes: [50, 50],
    minSize: 100,
    direction: "vertical",
    cursor: "row-resize",
});

let cssInContainer = document.getElementById("css-code-editor") as HTMLElement;
let cssInEditor = codemirror(cssInContainer, {
  value: defaultDemo.css,
  mode: "css",
  theme: "mdn-like",
  lineNumbers: true,

});

let tmplInContainer = document.getElementById("tmpl-code-editor") as HTMLElement;
let tmplInEditor = codemirror(tmplInContainer, {
  value: defaultDemo.template,
  mode: "htmlmixed",
  theme: "mdn-like",
  lineNumbers: true,
});

let cssOutContainer = document.getElementById("css-code-output") as HTMLElement;
let cssOutEditor = codemirror(cssOutContainer, {
  value: ``,
  mode: "css",
  theme: "mdn-like",
  lineNumbers: true,
  readOnly: true,
});

let tmplOutContainer = document.getElementById("tmpl-code-output") as HTMLElement;
let tmplOutEditor = codemirror(tmplOutContainer, {
  value: ``,
  mode: "htmlmixed",
  theme: "mdn-like",
  lineNumbers: true,
  readOnly: true,
});

function query(): URLSearchParams {
  return new URL(document.location.toString()).searchParams;
}

function autoSaveOptions() {
  return Object.keys(FEATURE_TOGGLES).reduce((flags, opt) => {
    flags[opt] = !!window.localStorage.getItem(opt);
    return flags;
  },                                         {} as Partial<FeatureFlags>);
}

function autoSaveData(options = autoSaveOptions()): Demo | undefined {
  let css = window.localStorage.getItem("css-input");
  let template = window.localStorage.getItem("tmpl-input");
  if (!css || !template) return;
  return {
    name: "<AutoSave>",
    unlinkable: true,
    default: true,
    css,
    template,
    options,
  };
}

function setDefault(demos: Array<Demo>, demo: Demo | undefined) {
  if (!demo) return;
  for (let d of demos) {
    d.default = (d === demo);
  }
}

function initDemos(demos: Array<Demo>, defaultOptions: Partial<FeatureFlags>): [Array<Demo>, Demo] {
  let  q = query();
  let demoName = q.get("demo");
  let queriedDemo = demoName && demos.find(d => d.name === demoName) || undefined;
  let lastSave = autoSaveData(defaultOptions);
  if (lastSave) {
    demos.unshift(lastSave);
  }
  setDefault(demos, queriedDemo || lastSave);

  demos.forEach((demo, i) => {
    demoSelect.options.add(new Option(demo.name, i.toString(), !!demo.default));
    if (demo.default) {
      demoSelect.selectedIndex = i;
    }
  });

  const changeHandler = (addHistory = true) => {
    let selIndex = parseInt(demoSelect.value);
    let demo = demos[selIndex];
    if (demo.options) {
      for (let [opt, val] of objectEntries(demo.options)) {
        FEATURE_TOGGLES[opt].checked = val!;
      }
    }
    cssInEditor.setValue(demo.css);
    tmplInEditor.setValue(demo.template);
    if (addHistory) {
      let url = new URL(document.location.toString());
      if (demo.unlinkable) {
        url.searchParams.delete("demo");
      } else {
        url.searchParams.set("demo", demo.name);
      }
      window.history.pushState(demo, demo.name, url.toString());
    }
    return process();
  };
  demoSelect.onchange = changeHandler.bind(null, true);

  window.onpopstate = (ev) => {
    let demo: Demo = ev.state;
    let i = demos.findIndex(d => d.name === demo.name);
    if (i >= 0) {
      demoSelect.selectedIndex = i;
      return changeHandler(false);
    } else {
      return;
    }
  };

  return [demos, demos.find(d => !!d.default) || demos[0]];
}

export class DemoOptimizer {
  run(html: string, css: string): Promise<void> {

    window.localStorage.setItem("css-input", css);
    window.localStorage.setItem("tmpl-input", html);

    let template = new TestTemplate("input.tmpl", html);
    let analyzer = new SimpleAnalyzer(template);
    return analyzer.analyze().then(analysis => {
      let analyzedAttributes = [];
      if (FEATURE_TOGGLES["analyzeForms"].checked) {
        analyzedAttributes.push("type", "disabled", "checked");
      }
      if (FEATURE_TOGGLES["analyzeIds"].checked) {
        analyzedAttributes.push("id");
      }
      let rewriteConfig = {
        analyzedAttributes,
        rewriteIdents: { class: true, id: FEATURE_TOGGLES["rewriteIds"].checked },
      };
      let optimizer = new Optimizer({
        removeUnusedStyles: FEATURE_TOGGLES["removeUnusedStyles"].checked,
        // conflictResolution: FEATURE_TOGGLES['conflictResolution'].checked,
        mergeDeclarations: FEATURE_TOGGLES["mergeDeclarations"].checked,
        rewriteIdents: FEATURE_TOGGLES["rewriteIdents"].checked,
      },                            rewriteConfig);

      optimizer.addSource({
        content: css,
        filename: "/FOO/input.css",
      });
      optimizer.addAnalysis(analysis);
      return optimizer.optimize("optimized.css").then(result => {
        let out = prettier.format(String(result.output.content), { filepath: "input.css" });
        cssOutEditor.setValue(out);
        let runner = new SimpleTemplateRunner(template);
        let rewriter = new SimpleTemplateRewriter(result.styleMapping, optimizer.templateOptions);
        let rewritten = "";
        let demo = "";

        return runner.runAll().then(permutations => {
          let idx = 0;
          for (let permutation of permutations) {
            rewritten += `// Permutation ${idx}\n${rewriter.rewrite(template, permutation)}\n\n`;
            demo += `<section style="padding: 12px; background-color: #eee;border-radius: 4px;margin-bottom: 18px;"><h1 style="font-size: 16px;margin: 0 0 8px;font-family: monospace;font-weight: normal;opacity: .85;">Permutation ${idx}</h1>${rewriter.rewrite(template, permutation)}</section>\n\n`;
            idx++;
          }

          tmplOutEditor.setValue(rewritten);

          const demoContainer = document.getElementById("tmpl-live-demo") as HTMLIFrameElement;
          if (demoContainer && demoContainer.contentWindow) {
            demoContainer.contentWindow.document.open();
            demoContainer.contentWindow.document.write(`<style>${out}</style> ${demo}`);
            demoContainer.contentWindow.document.close();
          }

          const terminal = document.getElementById("terminal") as HTMLElement;
          terminal.innerHTML = "";
          let table = document.createElement("table");
          terminal.appendChild(table);
          let tbody = table.createTBody();
          for (let a of result.actions.performed) {
            let row = tbody.insertRow();
            let optimizationCell = row.insertCell();
            optimizationCell.innerText = a.optimization;
            let positionCell = row.insertCell();
            positionCell.innerText = cleanPaths(a.positionString(a.sourcePosition));
            let messageCell = row.insertCell();
            let messageText = document.createElement("pre");
            messageCell.appendChild(messageText);
            messageText.appendChild(document.createTextNode(logMessage(a)));
          }

          let timingTotal = optimizer.timings.total.end - optimizer.timings.total.start;

          // tslint:disable:no-console
          (document.getElementById("build-time-output") as HTMLElement).innerHTML = `${timingTotal}ms`;
          let sizes = [
            cssSize(html, {}, () => Promise.resolve({css: ""})).then((res: SizeResults) => {
              console.log("HTML Size Change");
              console.log(res);
            }),
            cssSize(css, {}, () => Promise.resolve({css: result.output.content.toString()})).then((res: SizeResults) => {
              console.log("CSS Size Change");
              console.log(res);
            }),
          ];
          // tslint:enable:no-console
          return Promise.all(sizes).then(() => {});
        });
      });
    });
  }
}

function stripPreamble(message: string): string {
  let i = message.indexOf("]");
  return message.substring(i + 1);
}
function cleanPaths(message: string): string {
  return message.replace(/\/FOO\//g, "");
}
function logMessage(action: Action): string {
  if (isMultiAction(action)) {
    return action.logStrings().map(s => cleanPaths(stripPreamble(s))).join("\n");
  } else {
    return cleanPaths(stripPreamble(action.logString()));
  }
}

let optimizer = new DemoOptimizer();
function process() {
  return optimizer.run(tmplInEditor.getValue(), cssInEditor.getValue());
}
function processAndUpdateState() {
  return process().then(() => {
    if (demos[0].unlinkable) {
      demos[0] = autoSaveData()!;
    } else {
      let autosave = autoSaveData();
      if (autosave) demos.unshift(autosave);
    }
    let url = new URL(document.location.toString());
    if (url.searchParams.has("demo")) {
      url.searchParams.delete("demo");
      demoSelect.selectedIndex = 0;
      window.history.pushState(demos[0], "Autosave", url.toString());
    } else {
      window.history.replaceState(demos[0], "Autosave", url.toString());
    }
  });
}
cssInEditor.on("keyup", processAndUpdateState);
tmplInEditor.on("keyup", processAndUpdateState);

(document.getElementById("terminal-toggle") as HTMLElement).addEventListener("click", function(e: Event) {
  (e.target as HTMLElement).classList.toggle("active");
  (document.getElementById("terminal") as HTMLElement).classList.toggle("show");
});

(document.getElementById("preview-toggle") as HTMLElement).addEventListener("click", function(e: Event) {
  (e.target as HTMLElement).classList.toggle("active");
  (document.getElementById("tmpl-live-demo") as HTMLElement).classList.toggle("show");
});

(document.getElementById("settings-toggle") as HTMLElement).addEventListener("click", function (e: Event) {
  (e.target as HTMLElement).classList.toggle("active");
  (document.getElementById("options-menu") as HTMLElement).classList.toggle("open");
});

function objectEntries<T extends object>(v: T): Array<[keyof T, T[keyof T]]> {
  let keys: Array<keyof T> = <Array<keyof T>>Object.keys(v);
  return keys.map((k: keyof T)  => {
    let e: [keyof T, T[keyof T]] = [k, v[k]];
    return e;
  });
}

let initialOptions = defaultDemo.options || defaultOptions;
for (let [key, flag] of objectEntries(initialOptions)) {
  window.localStorage.setItem(key, flag ? "on" : "");
  let el = FEATURE_TOGGLES[key];
  el.checked = !!flag;
  el.addEventListener("click", function(e: Event) {
    let target = (e.target as HTMLInputElement);
    window.localStorage.setItem(target.id, target.checked ? "on" : "");
    return process();
  });
}

window.requestAnimationFrame(process);

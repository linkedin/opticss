import {
  SimpleTemplateRunner,
  TestTemplate,
  SimpleTemplateRewriter,
  SimpleAnalyzer,
} from '@opticss/simple-template';
import { Optimizer } from "opticss";

import * as path from 'path';
import * as prettier from 'prettier';
import { SizeResults, process as cssSize } from "./css-size-fake";
const Split = require('split.js');

import * as codemirror from 'codemirror';
import * as cssmode from 'codemirror/mode/css/css';
import * as htmlmode from 'codemirror/mode/htmlmixed/htmlmixed';
import * as showhint from 'codemirror/addon/hint/show-hint';
import * as csshint from 'codemirror/addon/hint/css-hint';

// For the sake of typescript!
console.log(cssmode, htmlmode, showhint, csshint);

Split(['#css-code-editor', '#tmpl-code-editor'], {
    sizes: [50, 50],
    minSize: 100,
    direction: 'vertical',
    cursor: 'row-resize'
});

Split(['#css-code-output', '#tmpl-code-output'], {
    sizes: [50, 50],
    minSize: 100,
    direction: 'vertical',
    cursor: 'row-resize'
});

let cssInContainer = document.getElementById('css-code-editor') as HTMLElement;
let cssInEditor = codemirror(cssInContainer, {
  value: window.localStorage.getItem('css-input') || `.bar {
  color: blue;
}
.foo {
  color: green;
}
.foo.bar {
  color: red;
}
`,
    mode: 'css',
    theme: 'mdn-like',
    lineNumbers: true

  });

  let tmplInContainer = document.getElementById('tmpl-code-editor') as HTMLElement;
  let tmplInEditor = codemirror(tmplInContainer, {
    value: window.localStorage.getItem('tmpl-input') || `<div class="foo bar"></div>`,
    mode: 'htmlmixed',
    theme: 'mdn-like',
    lineNumbers: true
  });

  let cssOutContainer = document.getElementById('css-code-output') as HTMLElement;
  let cssOutEditor = codemirror(cssOutContainer, {
    value: ``,
    mode: 'css',
    theme: 'mdn-like',
    lineNumbers: true,
    readOnly: true
  });

  let tmplOutContainer = document.getElementById('tmpl-code-output') as HTMLElement;
  let tmplOutEditor = codemirror(tmplOutContainer, {
    value: ``,
    mode: 'htmlmixed',
    theme: 'mdn-like',
    lineNumbers: true,
    readOnly: true
  });

export class DemoOptimizer {
  run(html: string, css: string): Promise<void> {

    window.localStorage.setItem('css-input', css);
    window.localStorage.setItem('tmpl-input', html);

    let template = new TestTemplate('/input.tmpl', html);
    let analyzer = new SimpleAnalyzer(template);
    return analyzer.analyze().then(analysis => {
      let optimizer = new Optimizer({
        removeUnusedStyles: FEATURE_TOGGLES['removeUnusedStyles'].checked,
        conflictResolution: FEATURE_TOGGLES['conflictResolution'].checked,
        mergeDeclarations: FEATURE_TOGGLES['mergeDeclarations'].checked,
        rewriteIdents: FEATURE_TOGGLES['rewriteIdents'].checked,
      }, {rewriteIdents: { class: true, id: false}});
      optimizer.addSource({
        content: css,
        filename: 'input.css'
      });
      optimizer.addAnalysis(analysis);
      return optimizer.optimize('/optimized.css').then(result => {
        let out = prettier.format(String(result.output.content), { filepath: 'input.css' });
        cssOutEditor.setValue(out);
        let runner = new SimpleTemplateRunner(template);
        let rewriter = new SimpleTemplateRewriter(result.styleMapping, {
          rewriteIdents: {
            id: true,
            class: true
          },
          analyzedAttributes: [],
          analyzedTagnames: false
        });
        let rewritten = '';
        let demo = '';

        return runner.runAll().then(permutations => {
          let idx = 0;
          for (let permutation of permutations) {
            rewritten += `// Permutation ${idx}\n${rewriter.rewrite(template, permutation)}\n\n`;
            demo += `<section style="padding: 12px; background-color: #eee;border-radius: 4px;margin-bottom: 18px;"><h1 style="font-size: 16px;margin: 0 0 8px;font-family: monospace;font-weight: normal;opacity: .85;">Permutation ${idx}</h1>${rewriter.rewrite(template, permutation)}</section>\n\n`;
            idx++;
          }

          tmplOutEditor.setValue(rewritten);

          const demoContainer = document.getElementById('tmpl-live-demo') as any;
          if (demoContainer) {
            demoContainer.contentWindow.document.open();
            demoContainer.contentWindow.document.write(`<style>${out}</style> ${demo}`);
            demoContainer.contentWindow.document.close();
          }

          let log = document.createDocumentFragment();
          const terminal = document.getElementById('terminal') as HTMLElement;
          for (let a of result.actions.performed) {
            let p = document.createElement('p');
            p.appendChild(document.createTextNode(a.logString().replace(new RegExp(path.resolve(__dirname, "../../") + "/", "g"), "")));
            log.appendChild(p);
          }
          terminal.innerHTML = '';
          terminal.appendChild(log);

          let timingTotal = optimizer.timings.total.end - optimizer.timings.total.start;

          (document.getElementById('build-time-output') as HTMLElement).innerHTML = `${timingTotal}ms`;
          let sizes = [
            cssSize(html, {}, () => Promise.resolve('')).then((res: SizeResults) => {
              console.log("HTML Size Change");
              console.log(res);
            }),
            cssSize(css, {}, () => Promise.resolve(result.output.content.toString())).then((res: SizeResults) => {
              console.log("CSS Size Change");
              console.log(res);
            })
          ];
          return Promise.all(sizes).then(() => {});
        });
      });
    });
  }
}

let optimizer = new DemoOptimizer();
function process(){
  optimizer.run(tmplInEditor.getValue(), cssInEditor.getValue());
}
cssInEditor.on('keyup', process);
tmplInEditor.on('keyup', process);

(document.getElementById('terminal-toggle') as HTMLElement).addEventListener('click', function(e: Event) {
  (e.target as HTMLElement).classList.toggle('active');
  (document.getElementById('terminal') as HTMLElement).classList.toggle('show');
});

(document.getElementById('preview-toggle') as HTMLElement).addEventListener('click', function(e: Event) {
  (e.target as HTMLElement).classList.toggle('active');
  (document.getElementById('tmpl-live-demo') as HTMLElement).classList.toggle('show');
});

(document.getElementById('settings-toggle') as HTMLElement).addEventListener('click', function (e: Event) {
  (e.target as HTMLElement).classList.toggle('active');
  (document.getElementById('options-menu') as HTMLElement).classList.toggle('open');
});

const FEATURE_TOGGLES = {
  removeUnusedStyles: (document.getElementById('removeUnusedStyles') as HTMLInputElement),
  conflictResolution: (document.getElementById('conflictResolution') as HTMLInputElement),
  mergeDeclarations: (document.getElementById('mergeDeclarations') as HTMLInputElement),
  rewriteIdents: (document.getElementById('rewriteIdents') as HTMLInputElement),
};

for (let key in FEATURE_TOGGLES) {
  const el = FEATURE_TOGGLES[key];
  let prev = (window.localStorage.getItem(key) === null) ? true : !!window.localStorage.getItem(key);
  window.localStorage.setItem(key, prev ? 'on' : '');
  el.checked = prev;
  el.addEventListener('click', function(e: Event) {
    let target = (e.target as HTMLInputElement);
    window.localStorage.setItem(target.id, target.checked ? 'on' : '');
    process();
  });
}

window.requestAnimationFrame(process);

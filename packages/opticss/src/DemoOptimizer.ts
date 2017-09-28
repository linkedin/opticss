import {
  SimpleTemplateRunner,
} from '../test/util/SimpleTemplateRunner';
import { Optimizer } from "./Optimizer";
import { TestTemplate } from "../test/util/TestTemplate";
import { SimpleAnalyzer } from "../test/util/SimpleAnalyzer";
import { SimpleTemplateRewriter } from "../test/util/SimpleTemplateRewriter";
import * as fs from 'fs';
import * as path from 'path';
import * as cssSize from "css-size";

export class DemoOptimizer {
  run() {
    let html = fs.readFileSync("demo/input.html", "utf-8");
    let template = new TestTemplate("demo/input.html", html);
    let analyzer = new SimpleAnalyzer(template);
    analyzer.analyze().then(analysis => {
      let optimizer = new Optimizer({except: ["removeUnusedStyles"]}, {rewriteIdents: { class: true, id: false}});
      let css = fs.readFileSync("demo/input.css", "utf-8");
      optimizer.addSource({
        content: css,
        filename: "demo/input.css"
      });
      optimizer.addAnalysis(analysis);
      return optimizer.optimize("demo/output.css").then(result => {
        console.log("optimized css output to demo/output.css");
        fs.writeFileSync(`demo/output.css`, result.output.content);
        let runner = new SimpleTemplateRunner(template);
        let rewriter = new SimpleTemplateRewriter(result.styleMapping);
        return runner.runAll().then(permutations => {
          let index = 0;
          let primaryOutput = "";
          for (let permutation of permutations) {
            if (index === 0) {
              primaryOutput = permutation;
            }
            let rewritten = rewriter.rewrite(template, permutation);
            console.log(`optimized markup written to demo/output-${++index}.html`);
            fs.writeFileSync(`demo/output-${index}.html`, rewritten);
          }

          console.log("logs written to demo/demo.log");
          let f = fs.openSync("demo/demo.log", "w");
          for (let a of result.actions.performed) {
            let message = a.logString().replace(new RegExp(path.resolve(__dirname, "../../") + "/", "g"), "");
            fs.writeSync(f, message + "\n");
          }
          fs.closeSync(f);

          console.log("Durations (in ms):");
          console.log(optimizer.timings);
          let sizes = [
            cssSize.table(html, {}, () => Promise.resolve({css: primaryOutput})).then((table) => {
              console.log("HTML Size Change");
              console.log(table);
            }),
            cssSize.table(css, {}, () => Promise.resolve({css: result.output.content.toString()})).then((table) => {
              console.log("CSS Size Change");
              console.log(table);
            })
          ];
          return Promise.all(sizes);
        });
      });
    });
  }
}
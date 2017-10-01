import {
  SimpleTemplateRunner,
  TestTemplate,
  SimpleTemplateRewriter,
  SimpleAnalyzer,
} from '@opticss/simple-template';
import { Optimizer } from "opticss";
import * as fs from 'fs';
import * as path from 'path';
import * as cssSize from "css-size";

export class DemoOptimizer {
  htmlFile: string;
  outputDir: string;
  cssFile: string;
  constructor(htmlFile: string, cssFile: string, outputDir: string) {
    this.htmlFile = htmlFile;
    this.cssFile = cssFile;
    this.outputDir = outputDir;
  }
  outputCssFile(): string {
    return path.join(this.outputDir, "optimized.css");
  }
  outputLogFile(): string {
    return path.join(this.outputDir, "opticss.log");
  }
  outputHtmlFile(index = 0): string {
    let suffix = index ? "-" + (index + 1) : "";
    return path.join(this.outputDir, `optimized${suffix}.html`);
  }
  run(): Promise<void> {
    let html = fs.readFileSync(this.htmlFile, "utf-8");
    let template = new TestTemplate(this.htmlFile, html);
    let analyzer = new SimpleAnalyzer(template);
    return analyzer.analyze().then(analysis => {
      let optimizer = new Optimizer({except: ["removeUnusedStyles"]}, {rewriteIdents: { class: true, id: false}});
      let css = fs.readFileSync(this.cssFile, "utf-8");
      optimizer.addSource({
        content: css,
        filename: this.cssFile
      });
      optimizer.addAnalysis(analysis);
      return optimizer.optimize(this.outputCssFile()).then(result => {
        console.log("optimized css output to demo/output.css");
        fs.writeFileSync(this.outputCssFile(), result.output.content);
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
            fs.writeFileSync(this.outputHtmlFile(index), rewritten);
            console.log(`optimized markup written to ${this.outputHtmlFile(index)}`);
            index++;
          }

          console.log("logs written to demo/demo.log");
          let f = fs.openSync(this.outputLogFile(), "w");
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
          return Promise.all(sizes).then(() => {});
        });
      });
    });
  }
}
import * as postcss from "postcss";

export function walkRules(container: postcss.Container, eachRule: (rule: postcss.Rule) => void) {
  container.walkRules(rule => {
    // postcss treats keyframes as normal rules but they really aren't.
    if (rule.parent.type === "atrule" && (<postcss.AtRule>rule.parent).name.includes("keyframes")) {
      return;
    }
    eachRule(rule);
  });
}
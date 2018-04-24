export function clean(strings: TemplateStringsArray, ...expressions: string[]) {
  let str = strings.reduce(
    (prev, s, i) =>
      prev + s + ((expressions.length > i) ? expressions[i].toString() : ""),
    "");
  return str.split("\n").map(s => s.trim()).join("\n").trim();
}

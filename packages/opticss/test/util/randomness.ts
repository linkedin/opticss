import * as RandomJS from "random-js";

export function getRandom(opts: { seed?: number, verbose?: boolean}): RandomJS {
  const seed = opts.seed || RandomJS.engines.nativeMath();
  if (opts.verbose) {
    console.log(`Random seed is: ${seed}`);
  }
  return new RandomJS(RandomJS.engines.mt19937().seed(seed));
}
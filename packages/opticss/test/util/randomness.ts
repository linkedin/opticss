import { MersenneTwister19937, Random, nativeMath } from "random-js";

export function getRandom(opts: { seed?: number; verbose?: boolean}): Random {
  const seed = opts.seed || nativeMath.next();
  if (opts.verbose) {
    // tslint:disable-next-line:no-console
    console.log(`Random seed is: ${seed}`);
  }
  let engine = MersenneTwister19937.seed(seed);
  return new Random(engine);
}

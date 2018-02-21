const gzip = require("gzip-js");

// TODO: Add in-app brotli compression.

function getBinarySize(str: string) {
  return Buffer.byteLength(str, "utf8");
}

export interface SizeResults {
  in: number;
  out: number;
  inZip: number;
  outZip: number;
  // inBrotli: number;
  // outBrotli: number;
}

export function process(pre: string, opts: {level?: number}, post: () => Promise<{css: string}>): Promise<SizeResults> {
  return post().then((post) => {

    let zipPre = gzip.zip(pre, {
      level: opts.level || 6,
      name: "pre.css",
      timestamp: Date.now() / 1000,
    });

    let zipPost = gzip.zip(post.css, {
      level: opts.level || 6,
      name: "post.css",
      timestamp: Date.now() / 1000,
    });

    return Promise.resolve({
      in: getBinarySize(pre),
      out: getBinarySize(post.css),
      inZip: zipPre.length,
      outZip: zipPost.length,
    });
  });
}

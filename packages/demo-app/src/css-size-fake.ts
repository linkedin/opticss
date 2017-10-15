const gzip = require('gzip-js');

// TODO: Add in-app brotli compression.

function getBinarySize(string: string) {
  return Buffer.byteLength(string, 'utf8');
}

export interface SizeResults {
  in: number;
  out: number;
  inZip: number;
  outZip: number;
  // inBrotli: number;
  // outBrotli: number;
}

export function process(pre: string, opts: any, post: () => Promise<string> ): Promise<SizeResults> {
  return post().then((post: any) => {

    let zipPre = gzip.zip(pre, {
      level: opts.level || 6,
      name: 'pre.css',
      timestamp: Date.now() / 1000
    });

    let zipPost = gzip.zip(post, {
      level: opts.level || 6,
      name: 'post.css',
      timestamp: Date.now() / 1000
    });

    return Promise.resolve({
      in: getBinarySize(pre),
      out: getBinarySize(post.css),
      inZip: zipPre.length,
      outZip: zipPost.length,
    });
  });
}

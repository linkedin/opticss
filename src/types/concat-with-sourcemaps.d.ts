declare module "concat-with-sourcemaps" {
  import * as sourcemap from 'source-map';
  class Concat {
    readonly content: Buffer;
    readonly sourceMap: string | undefined;
    constructor(generateSourceMap: boolean, fileName: string, separator?: string);
    add(fileName: string | null, content: string | Buffer, sourceMap: string | sourcemap.RawSourceMap): void;
  }
}
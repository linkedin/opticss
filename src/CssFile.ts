import * as postcss from "postcss";
import { RawSourceMap } from "source-map";

export interface CssFile {
  /**
   * A CSS file's contents. If this was previously processed with postcss, just
   * pass the parsed contents along -- no sense in making a bunch of extra work
   * for ourselves.
   */
  content: postcss.Result | string;

  /**
   * The path to the file's contents. This is used for debugging purposes the
   * contents are not read from the filename's location.
   */
  filename?: string;

  /**
   * If the file was processed, a sourcemap should be provided.
   * If a postcss.Result is returned for contents, the sourcemap from that
   * object will be used if this property is not set.
   */
  sourceMap?: RawSourceMap | string;
}

export interface ParsedCssFile {
  content: postcss.Result;

  /**
   * The path to the file's contents. This is used for debugging purposes the
   * contents are not read from the filename's location.
   */
  filename?: string;
}

export function sourceMapFromCssFile(file: CssFile): RawSourceMap | string | undefined {
  let sourceMap: RawSourceMap | string | undefined = file.sourceMap;
  if (!sourceMap && (<postcss.Result>file.content).map) {
    sourceMap = <RawSourceMap>(<postcss.Result>file.content).map.toJSON();
  }
  return sourceMap;
}
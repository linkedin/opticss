import * as postcss from "postcss";
import { RawSourceMap } from "source-map";

import { adaptFromLegacySourceMap, LegacyRawSourceMap } from "./util/adaptSourceMap";

/**
 * Represents a single CSS file and its associated meta-data.
 */
export interface CssFile {
  /**
   * A CSS file's contents. If this was previously processed with postcss, just
   * pass the parsed contents along -- no sense in making a bunch of extra work
   * for ourselves.
   */
  content: postcss.Result | string;

  /**
   * The path to the file's contents. This is used for debugging purposes the
   * contents are not read from the file name's location.
   */
  filename?: string;

  /**
   * If the file was processed, a sourcemap should be provided.
   * If a postcss.Result is returned for contents, the sourcemap from that
   * object will be used if this property is not set.
   */
  sourceMap?: LegacyRawSourceMap | RawSourceMap | string;
}

export interface ParsedCssFile {
  content: postcss.Result;

  /**
   * The path to the file's contents. This is used for debugging purposes the
   * contents are not read from the file name's location.
   */
  filename?: string;
}

/**
 * Given a CssFile, return the source map.
 * @param file CssFile
 * @returns The RawSourceMap or source map string, if present.
 */
export function sourceMapFromCssFile(file: CssFile): RawSourceMap | string | undefined {
  let sourceMap: LegacyRawSourceMap | RawSourceMap | string | undefined = file.sourceMap;
  if (!sourceMap && (<postcss.Result>file.content).map) {
    sourceMap = (<postcss.Result>file.content).map.toJSON();
  }
  if (typeof sourceMap === "object") {
    return adaptFromLegacySourceMap(sourceMap);
  } else {
    return sourceMap;
  }
}

import * as postcss from "postcss";
import { RawSourceMap } from "source-map";
// Adapts the older version of postcss's source map to the current version.
// if postcss upgrades this will still be valid, albeit, unnecessary.
export function adaptSourceMap(sourceMap: ReturnType<postcss.ResultMap["toJSON"]>): RawSourceMap {
  let newMap = {
    file: sourceMap.file || "",
    sourceRoot: sourceMap.sourceRoot,
    version: parseInt(sourceMap.version),
    sources: sourceMap.sources,
    names: sourceMap.names,
    sourcesContent: sourceMap.sourcesContent,
    mappings: sourceMap.mappings,
  };
  return newMap;
}

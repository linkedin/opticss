import { RawSourceMap } from "source-map";

// This is the old version of RawSourceMap
export interface LegacyRawSourceMap {
  file?: string;
  sourceRoot?: string;
  version: string;
  sources: string[];
  names: string[];
  sourcesContent?: string[];
  mappings: string;
}

/**
 * The type of RawSourceMap changed in a backwards incompatible way.
 * This function adapts code that might return an old version of the
 * RawSourceMap to match the current definition.
 */
export function adaptFromLegacySourceMap(sourceMap: LegacyRawSourceMap | RawSourceMap): RawSourceMap {
  // The legacy version was a number even though the type said it was a string.
  // But we handle strings here juuuust in case.
  let version =
    typeof sourceMap.version === "string"
      ? parseInt(sourceMap.version)
      : sourceMap.version;
  let newMap = {
    file: sourceMap.file || "",
    sourceRoot: sourceMap.sourceRoot,
    version,
    sources: sourceMap.sources,
    names: sourceMap.names,
    sourcesContent: sourceMap.sourcesContent,
    mappings: sourceMap.mappings,
  };
  return newMap;
}

/**
 * The type of RawSourceMap changed in a backwards incompatible way.
 * This function adapts code that might require an old version of the
 * RawSourceMap.
 */
export function adaptToLegacySourceMap(sourceMap: LegacyRawSourceMap | RawSourceMap): LegacyRawSourceMap {
  let newMap = {
    file: sourceMap.file || "",
    sourceRoot: sourceMap.sourceRoot,
    // The version was never actually a string, we cast through any to match the legacy behavior.
    version: sourceMap.version as any,
    sources: sourceMap.sources,
    names: sourceMap.names,
    sourcesContent: sourceMap.sourcesContent,
    mappings: sourceMap.mappings,
  };
  return newMap;
}

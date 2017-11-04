export const POSITION_UNKNOWN: SourcePosition = { line: -1 };

export interface SourcePosition {
  filename?: string;
  line: number;
  column?: number;
}

export function isSourcePosition(position: object): position is SourcePosition {
  return !!((<SourcePosition>position).line);
}

export interface SourceLocation {
  start: SourcePosition;
  end?: SourcePosition;
}

export function isSourceLocation(location: object): location is SourceLocation {
  return !!((<SourceLocation>location).start);
}
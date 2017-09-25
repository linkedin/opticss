export const POSITION_UNKNOWN: SourcePosition = { line: -1 };

export interface SourcePosition {
  filename?: string;
  line: number;
  column?: number;
}

export interface SourceLocation {
  start: SourcePosition;
  end?: SourcePosition;
}
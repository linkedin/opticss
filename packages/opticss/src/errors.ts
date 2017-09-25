export interface ErrorLocation {
  filename?: string;
  line?: number;
  column?: number;
}

/**
 * Custom Opticss error base class. Will format `ErrorLocation` into thrown
 * error message if provided.
 */
export class OpticssError extends Error {
  static prefix = "Error";
  origMessage: string;
  private _location?: ErrorLocation;
  constructor(message: string, location?: ErrorLocation) {
    super(message);
    this.origMessage = message;
    this._location = location;
    super.message = this.annotatedMessage();
  }

  private annotatedMessage() {
    let loc = this.location;
    if ( !loc ) {
      return this.origMessage;
    }
    let filename = loc.filename || '';
    let line = loc.line ? `:${loc.line}` : '';
    let column = loc.column ? `:${loc.column}` : '';
    let locMessage = ` (${filename}${line}${column})`;
    return `Opticss ${(this.constructor as any).prefix}: ${this.origMessage}${locMessage}`;
  }

  get location(): ErrorLocation | undefined {
    return this._location;
  }

}

/**
 * Custom Opticss error type for template analysis errors.
 */
export class TemplateError extends OpticssError {
  static prefix = "TemplateError";
  constructor(message: string, location?: ErrorLocation) {
    super(message, location);
  }
}
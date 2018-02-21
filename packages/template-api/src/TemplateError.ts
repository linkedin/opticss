import {
  ErrorLocation,
  OptiCSSError,
} from "@opticss/util";

/**
 * Custom OptiCSS error type for template analysis errors.
 */
export class TemplateError extends OptiCSSError {
  static prefix = "TemplateError";
  constructor(message: string, location?: ErrorLocation) {
    super(message, location);
  }
}

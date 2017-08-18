export interface Optimizations {
  /**
   * Whether to rewrite idents where possible.
   * Note: ident rewriting will only be enabled for the types of idents
   * that the rewriter can support.
   */
  rewriteIdents: boolean | {
    classnames: boolean;
    ids: boolean;
  };
  /**
   * Whether to remove styles that are not in use according to the template
   * analysis.
   */
  removeUnusedStyles: boolean;
}

export interface OptiCSSOptions extends Optimizations {
  /**
   * Whether to perform any optimizations.
   */
  enabled: boolean;
  /**
   * Only perform the optimizations specified and no others.
   */
  only?: Array<keyof Optimizations>;
  /**
   * Perform all optimizations except the ones specified. Overrides
   * optimizations enabled by the `only` option.
   */
  except?: Array<keyof Optimizations>;
}

export interface TemplateIntegrationOptions {
  rewriteIdents: {
    classnames: boolean;
    ids: boolean;
  };
}

export const DEFAULT_OPTIONS = Object.freeze<OptiCSSOptions>({
  enabled: true,
  rewriteIdents: true,
  removeUnusedStyles: true
});
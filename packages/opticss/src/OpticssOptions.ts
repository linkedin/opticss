import { RewritableIdents } from "../../@opticss/template-api/src";

export interface Optimizations {
  /**
   * Whether to rewrite idents where possible.
   * Note: ident rewriting will only be enabled for the types of idents
   * that the rewriter can support.
   */
  rewriteIdents: boolean | RewritableIdents;

  /**
   * Whether to remove styles that are not in use according to the template
   * analysis.
   */
  removeUnusedStyles: boolean;

  /**
   * Whether to merge declarations across compatible selectors.
   */
  mergeDeclarations: boolean;
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

  /**
   * Some CSS features can be used for more optimal output but may have
   * varying level of support. These options control wether the optimizer
   * will take advantage of those features where it can.
   *
   * CSS features are never output with vendor prefixes. You can try using
   * autoprefixer or cssnext, but doing so is likely to result in output that
   * is less optimal than if the optimization hadn't been performed.
   */
  css?: Partial<CSSFeatureFlags>;

}

export const DEFAULT_OPTIONS = Object.freeze<OptiCSSOptions>({
  enabled: true,
  rewriteIdents: true,
  removeUnusedStyles: true,
  mergeDeclarations: true,
  css: {},
});

export interface CSSFeatureFlags {
  useMatchesPseudoClass: boolean;

  /**
   * Indicates that class and id selectors should be treated as case-insensitive.
   * In quirksmode and some older doctypes, selectors are case insensitive.
   *
   * Identifiers are more compressible when case sensitivity can be assumed.
   */
  caseInsensitiveSelectors: boolean;
}

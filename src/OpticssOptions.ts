export interface RewritableIdents {
  /** whether ids should be rewritten. */
  id: boolean;
  /** whether class names should be rewritten. */
  class: boolean;
  /**
   * idents that are in use and should not be generated despite not being
   * found in any analysis or stylesheet.
   */
  omitIdents?: {
    id?: Array<string>;
    class?: Array<string>;
  };
}

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
   * Whether to share declarations across compatible selectors.
   */
  shareDeclarations: boolean;
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

export interface TemplateIntegrationOptions {
  rewriteIdents: RewritableIdents;
}

export const DEFAULT_OPTIONS = Object.freeze<OptiCSSOptions>({
  enabled: true,
  rewriteIdents: true,
  removeUnusedStyles: true,
  shareDeclarations: true
});

export interface CSSFeatureFlags {
  useMatchesPseudoClass: boolean;
}

export interface NormalizedRewriteOptions {
  id: boolean;
  class: boolean;
  omitIdents: {
    id: Array<string>;
    class: Array<string>;
  };
}

export function rewriteOptions(
  appOptions: boolean | RewritableIdents,
  templateOptions: RewritableIdents
): NormalizedRewriteOptions {
  let combined: NormalizedRewriteOptions = {
    id: true,
    class: true,
    omitIdents: { id: [], class: []}
  };
  if (appOptions === false) {
    mergeIntoRewriteOpts(combined, {id: false, class: false});
  } else if (appOptions === true) {
    mergeIntoRewriteOpts(combined, templateOptions);
  } else {
    mergeIntoRewriteOpts(combined, appOptions);
    mergeIntoRewriteOpts(combined, templateOptions);
  }
  return combined;
}

function mergeIntoRewriteOpts(
  normalized: NormalizedRewriteOptions,
  opts: RewritableIdents
): void {
  normalized.id = normalized.id && opts.id;
  normalized.class = normalized.class && opts.class;
  if (opts.omitIdents && opts.omitIdents.id) {
    normalized.omitIdents.id =
      normalized.omitIdents.id.concat(opts.omitIdents.id);
  }
  if (opts.omitIdents && opts.omitIdents.class) {
    normalized.omitIdents.class =
      normalized.omitIdents.class.concat(opts.omitIdents.class);
  }
}

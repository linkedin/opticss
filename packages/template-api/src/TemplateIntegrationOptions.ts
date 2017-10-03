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

export type AnalyzedAttribute = string;
export type AnalyzedTagname = string;

export interface TemplateIntegrationOptions {
  rewriteIdents: RewritableIdents;
  /**
   * List of attributes in addition to the re-writable attributes of `id`
   * and/or `class` that are analyzed and known to the rewriter. These
   * attributes aren't rewritten (at this time), but their analysis may allow
   * selectors targeting them to be merged into otherwise shared class names.
   */
  analyzedAttributes: Array<AnalyzedAttribute>;
  /**
   * Whether the rewriter generally knows what tags styled attributes will
   * belong to. Setting this to false will prevent rules with element selectors
   * from being optimized if that optimization requires knowing the element's tag.
   */
  analyzedTagnames: boolean;
}
export interface NormalizedRewriteOptions {
  id: boolean;
  class: boolean;
  omitIdents: {
    id: Array<string>;
    class: Array<string>;
  };
}

export function normalizeTemplateOptions(
  templateOptions: Partial<TemplateIntegrationOptions>
): TemplateIntegrationOptions {
  if (templateOptions.rewriteIdents === undefined) {
    templateOptions.rewriteIdents = {
      id: false,
      class: true
    };
  }
  let analyzedAttributes = templateOptions.analyzedAttributes ?
    templateOptions.analyzedAttributes.splice(0) : [];
  if (templateOptions.rewriteIdents.id) analyzedAttributes.unshift("id");
  if (templateOptions.rewriteIdents.class) analyzedAttributes.unshift("class");
  return {
    analyzedTagnames: templateOptions.analyzedTagnames || true,
    analyzedAttributes,
    rewriteIdents: templateOptions.rewriteIdents,
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
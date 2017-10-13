/**
 * @file Provides a matching utility to resolve selectors against elements discovered
 * during template analysis.
 *
 * Provided a `Selectable` from '@opticss/template-api', and a `ParsedSelector` from
 * 'postcss-selector-parser', determine if the `ParsedSelector` matches the Selectable.
 *
 * Matches are of type `enum Match`, defined in './Match, and may be of type `Match.yes`,
 * `Match.no`, `Match.maybe`, `Match.pass`.
 */
export * from "./Match";
export { AttributeMatcher } from "./AttributeMatcher";
export { TagMatcher } from "./TagMatcher";
export { ElementMatcher } from "./ElementMatcher";

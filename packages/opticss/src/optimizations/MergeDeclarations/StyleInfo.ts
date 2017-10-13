import * as postcss from 'postcss';
import * as specificity from 'specificity';
import { MultiDictionary } from 'typescript-collections';

import { ParsedCssFile } from '../../CssFile';
import { ParsedSelector } from '../../parseSelector';
import { Element } from '@opticss/template-api';
import { RuleScope } from '../../util/cssIntrospection';

export interface SelectorInfo {
  /** The original rule node for eventual manipulation */
  rule: postcss.Rule;
  /** The AtRules that scope this selector. */
  scope: RuleScope;
  /** The selector parsed into compound selectors */
  selector: ParsedSelector;
  container: postcss.Node;
  /** The specificity of this selector */
  specificity: specificity.Specificity;
  /** The file this selector came from */
  file: ParsedCssFile;
  /**
   * The overall index of this selector.
   * Selectors from files with bigger numbers override
   * selectors from files with smaller numbers. */
  fileIndex: number;
  /**
   * A number indicating the general source order. higher numbers come later
   * in the source file.
   */
  sourceIndex: number;
  /** The analyzed elements that this selector might match. */
  elements: Array<Element>;
  /**
   * Quick compare for two selectors to see which wins. This is set once
   * all selectors are sorted initially.
   */
  ordinal: number;
  /**
   * declarations this selector sets.
   * maps property name to [value, important] pairs. Multiple values are set
   * when the rule set assigns the same property multiple times as is often done
   * for progressive enhancement.
   */
  declarations: MultiDictionary<string,[string, boolean, postcss.Declaration]>;

  /**
   * Maps property/value pairs that might be expanded to the declaration infos
   * for the declaration.
   */
  declarationInfos: MultiDictionary<[string, string], DeclarationInfo>;
}

export interface DeclarationInfo {
  selectorInfo: SelectorInfo;
  decl: postcss.Declaration;
  prop: string;
  value: string;
  important: boolean;
  /**
   * A single number that can be compared with another DeclarationInfo
   * to understand which one wins if both are applied on the same element.
   * Bigger numbers win.
   */
  ordinal: number;
  dupeCount: number;
}

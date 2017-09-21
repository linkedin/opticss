import { DeclarationInfo } from './StyleInfo';
import * as propParser from 'css-property-parser';
import * as postcss from 'postcss';
import * as specificity from 'specificity';
import { BSTree, Dictionary, MultiDictionary } from 'typescript-collections';
import { inspect } from 'util';

import { ExpandShorthand } from '../../actions/ExpandShorthand';
import { Declaration, MergeDeclarations as MergeDeclarationsAction } from '../../actions/MergeDeclarations';
import { ParsedCssFile } from '../../CssFile';
import { Initializers } from '../../initializers';
import { OptiCSSOptions, TemplateIntegrationOptions } from '../../OpticssOptions';
import { OptimizationPass } from '../../OptimizationPass';
import { ParsedSelector } from '../../parseSelector';
import { Element } from '../../Selectable';
import { TemplateAnalysis } from '../../TemplateAnalysis';
import { TemplateTypes } from '../../TemplateInfo';
import { expandIfNecessary } from '../../util/shorthandProperties';
import { MultiFileOptimization } from '../Optimization';
import { RuleScope, walkRules } from '../util';
import { OptimizationContext } from './OptimizationContext';
import { DeclarationMapper } from './DeclarationMapper';

interface Mergable {
  context: OptimizationContext;
  decls: DeclarationInfo[];
  decl: {
    prop: string;
    value: string;
    important: boolean;
  };
}

export class MergeDeclarations implements MultiFileOptimization {
  initializers: Array<keyof Initializers> = ["initKnownIdents"];

  private options: OptiCSSOptions;
  private templateOptions: TemplateIntegrationOptions;
  constructor(options: OptiCSSOptions, templateOptions: TemplateIntegrationOptions) {
    this.options = options;
    this.templateOptions = templateOptions;
  }
  optimizeAllFiles(
    pass: OptimizationPass,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    files: Array<ParsedCssFile>
  ): void {
    let mapper = new DeclarationMapper(pass, analyses, files);
    let mergables: Mergable[] = [];
    for (let context of mapper.contexts) {
      for (let prop of context.declarationMap.keys()) {
        let values = context.declarationMap.getValue(prop);
        for (let value of values.keys()) {
          let decls = values.getValue(value);
          let importantDecls = decls.filter(d => d.important);
          let normalDecls = decls.filter(d => !d.important);
          if (importantDecls.length > 1) {
            mergables.push({
              context,
              decls: importantDecls.map(d => {d.dupeCount = importantDecls.length - 1; return d;}),
              decl: { prop, value, important: true }
            });
          }
          if (normalDecls.length > 1) {
            mergables.push({
              context,
              decls: normalDecls.map(d => {d.dupeCount = normalDecls.length - 1; return d;}),
              decl: { prop, value, important: false }
            });
          }
        }
      }
    }

    let expandedProps = new Set<postcss.Declaration>();
    for (let mergable of mergables) {
      let decls = mergable.decls.filter(d => canMerge(mapper, d));
      if (decls.length > 1) {
        decls.forEach(d => {
          if (!expandedProps.has(d.decl)) {
            let infos = mapper.shortHands.get(d.decl);
            if (infos) {
              let toExpand = infos.filter(i => i.dupeCount === 0);
              pass.actions.perform(new ExpandShorthand(d.decl, toExpand, "mergeDeclarations", "Shorthand value was not duplicated anywhere."));
            }
            expandedProps.add(d.decl);
          }
        });
        this.mergeDeclarations(pass, mergable.context, decls, mergable.decl);
      }
    }
  }
  private mergeDeclarations(
    pass: OptimizationPass,
    context: OptimizationContext,
    declInfos: Array<DeclarationInfo>,
    decl: Declaration
  ) {
    let scope = context.scopes[0];
    let container = scope.length > 0 ? scope[scope.length - 1] : context.root;
    pass.actions.perform(new MergeDeclarationsAction(
      pass,
      container,
      context.selectorContext,
      decl,
      declInfos.map(declInfo => ({
        selector: declInfo.selectorInfo.selector,
        rule: declInfo.selectorInfo.rule,
        decl: declInfo.decl
      })),
      "mergeDeclarations",
      "Duplication"));
  }
}

function canMerge(mapper: DeclarationMapper, declInfo: DeclarationInfo): boolean {
  if (!propParser.isShorthandProperty(declInfo.decl.prop)) {
    return true;
  }
  let infos = mapper.shortHands.get(declInfo.decl);
  if (infos) {
    let duplicateCount = infos.reduce((total, info) => total + Math.min(info.dupeCount, 1), 1);
    return duplicateCount >= Math.ceil(infos.length / 2) + 1;
  } else {
    throw new Error("Missing decl info for declaration! " + inspect(declInfo));
  }
}
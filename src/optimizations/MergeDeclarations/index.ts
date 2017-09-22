import {
  expandIfNecessary,
  expandPropertyName,
} from '../../util/shorthandProperties';
import * as propParser from 'css-property-parser';
import * as postcss from 'postcss';
import {
  inspect,
} from 'util';

import {
  ExpandShorthand,
} from '../../actions/ExpandShorthand';
import {
  Declaration,
  MergeDeclarations as MergeDeclarationsAction,
} from '../../actions/MergeDeclarations';
import {
  ParsedCssFile,
} from '../../CssFile';
import {
  Initializers,
} from '../../initializers';
import {
  OptiCSSOptions,
  TemplateIntegrationOptions,
} from '../../OpticssOptions';
import {
  OptimizationPass,
} from '../../OptimizationPass';
import {
  TemplateAnalysis,
} from '../../TemplateAnalysis';
import {
  TemplateTypes,
} from '../../TemplateInfo';
import {
  MultiFileOptimization,
} from '../Optimization';
import {
  DeclarationMapper,
} from './DeclarationMapper';
import {
  OptimizationContext,
} from './OptimizationContext';
import {
  DeclarationInfo,
} from './StyleInfo';
import { Element } from '../../Selectable';
import { Actions } from '../../Actions';
import { AnnotateMergeConflict } from '../../actions/AnnotateMergeConflict';

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
              pass.actions.perform(new ExpandShorthand(d.decl, toExpand, "mergeDeclarations", "one or more of the long hand values was not duplicated anywhere."));
            }
            expandedProps.add(d.decl);
          }
        });
        this.mergeDeclarations(pass, mapper, mergable.context, decls, mergable.decl);
      }
    }
  }
  private mergeDeclarations(
    pass: OptimizationPass,
    mapper: DeclarationMapper,
    context: OptimizationContext,
    declInfos: Array<DeclarationInfo>,
    decl: Declaration
  ) {
    let scope = context.scopes[0];
    let container = scope.length > 0 ? scope[scope.length - 1] : context.root;
    let segments = this.segmentByCascadeConflicts(pass.actions, mapper, declInfos);

    for (let declInfos of segments) {
      if (declInfos.length < 2) continue;
      pass.actions.perform(new MergeDeclarationsAction(
        pass,
        container,
        context.selectorContext,
        decl,
        declInfos.map(declInfo => ({
          selector: declInfo.selectorInfo.selector,
          rule: declInfo.selectorInfo.rule,
          container: declInfo.selectorInfo.container,
          decl: declInfo.decl
        })),
        "mergeDeclarations",
        "Duplication"));
      let newOrdinal = declInfos[0].ordinal;
      for (let i = 1; i < declInfos.length; i++) {
        declInfos[i].ordinal = newOrdinal;
      }
    }

  }

  private segmentByCascadeConflicts(actions: Actions, mapper: DeclarationMapper, declInfos: Array<DeclarationInfo>): Array<Array<DeclarationInfo>> {
    if (declInfos.length === 0) {
      return [];
    }
    let props = expandPropertyName(declInfos[0].prop);
    let expanded = expandIfNecessary(new Set(props), declInfos[0].prop, declInfos[0].value);
    let groups = new Array<Array<DeclarationInfo>>();

    nextMerge:
    for (let unmergedDecl of declInfos) {
      nextGroup:
      for (let group of groups) {
        for (let mergedDecl of group) {
          for (let element of unmergedDecl.selectorInfo.elements) {
            let elInfo = mapper.elementDeclarations.get(element);
            if (!elInfo) continue;
            for (let prop of props) {
              let conflictDecls = elInfo.getValue(prop);
              for (let conflictDecl of conflictDecls) {
                if (expanded[prop] !== conflictDecl.value
                    && mergedDecl.ordinal < conflictDecl.ordinal
                    && unmergedDecl.ordinal > conflictDecl.ordinal) {
                  actions.perform(new AnnotateMergeConflict(
                    mergedDecl.decl, mergedDecl.selectorInfo.selector,
                    unmergedDecl.decl, unmergedDecl.selectorInfo.selector,
                    conflictDecl.decl, conflictDecl.selectorInfo.selector,
                    element
                  ));
                  continue nextGroup;
                }
              }
            }
          }
        }
        group.push(unmergedDecl);
        continue nextMerge;
      }
      groups.push(new Array<DeclarationInfo>(unmergedDecl));
    }
    return groups;
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
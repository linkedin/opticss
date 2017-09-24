import {
  StringDict,
} from '../../util/UtilityTypes';
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

interface MergableDeclarationSet {
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
    for (let context of mapper.contexts) {
      let contextMergables = this.mergablesForContext(context);
      let shorthands = mergedShorthandsForContext(contextMergables);
      let segmentedContextMergables = this.segmentByCascadeConflicts(pass.actions, mapper, contextMergables);
      segmentedContextMergables = this.checkAndExpandShorthands(pass, mapper, shorthands, segmentedContextMergables);
      for (let mergableSets of segmentedContextMergables) {
        for (let mergableSet of mergableSets) {
          if (mergableSet.decls.length < 2) continue;
          this.mergeDeclarationSet(pass, mergableSet);
        }
      }
    }

  }
  private mergablesForContext(context: OptimizationContext) {
    let contextMergables = new Array<MergableDeclarationSet>();
    for (let prop of context.declarationMap.keys()) {
      let values = context.declarationMap.getValue(prop);
      for (let value of values.keys()) {
        let decls = values.getValue(value);
        let importantDecls = decls.filter(d => d.important);
        let normalDecls = decls.filter(d => !d.important);
        if (importantDecls.length > 1) {
          contextMergables.push({
            context,
            decls: importantDecls,
            decl: { prop, value, important: true }
          });
        }
        if (normalDecls.length > 1) {
          contextMergables.push({
            context,
            decls: normalDecls,
            decl: { prop, value, important: false }
          });
        }
      }
    }
    return contextMergables;
  }
  private mergeDeclarationSet(
    pass: OptimizationPass,
    mergeableDeclarations: MergableDeclarationSet
  ) {
    let context = mergeableDeclarations.context;
    let declInfos = mergeableDeclarations.decls;
    let decl = mergeableDeclarations.decl;
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
        container: declInfo.selectorInfo.container,
        decl: declInfo.decl
      })),
      "mergeDeclarations",
      "Duplication"));
    // The declarations are inserted at the document location of the first declaration it
    // is merged with. So we update its declarations to that ordinal value.
    let newOrdinal = declInfos[0].ordinal;
    for (let i = 1; i < declInfos.length; i++) {
      declInfos[i].ordinal = newOrdinal;
    }
  }

  private checkAndExpandShorthands(
    pass: OptimizationPass,
    mapper: DeclarationMapper,
    shorthands: Set<postcss.Declaration>,
    mergableSets: MergableDeclarationSet[][]
  ): MergableDeclarationSet[][] {
    let mergableShorthands = new Set<postcss.Declaration>();
    let unmergableShorthands = new Set<postcss.Declaration>();
    for (let shorthand of shorthands) {
      if (canMerge(mapper, shorthand)) {
        mergableShorthands.add(shorthand);
      } else {
        unmergableShorthands.add(shorthand);
      }
    }
    let mergedLonghands = new Set<DeclarationInfo>();
    for (let segments of mergableSets) {
      for (let mergableSet of segments) {
        for (let declInfo of mergableSet.decls) {
          if (mergableSet.decls.length > 1 && mergableShorthands.has(declInfo.decl)) {
            mergedLonghands.add(declInfo);
          } else if (unmergableShorthands.has(declInfo.decl)) {
            mergableSet.decls.splice(mergableSet.decls.indexOf(declInfo), 1);
            mergableSet.decls.forEach(d => {d.dupeCount = d.dupeCount - 1;});
            declInfo.dupeCount = 0;
          }
        }
      }
    }
    for (let mergableShorthand of mergableShorthands) {
      let infos = mapper.shortHands.get(mergableShorthand);
      if (infos) {
        let toExpand = infos.filter(i => !mergedLonghands.has(i));
        pass.actions.perform(new ExpandShorthand(mergableShorthand, toExpand, "mergeDeclarations", "one or more of the long hand values was not duplicated anywhere."));
      }
    }
    return mergableSets;
  }

  /**
   * Analyzes declarations that can be merged within the same optimization context
   * and segments them by cascade conflicts.
   *
   * A cascade conflict occurs when the declarations we'd like to merge have an
   * intervening declaration that sets the value to a different value on the same
   * element for at least one runtime state.
   *
   * TODO:
   *   - Move the merged declaration down the cascade if possible to facilitate
   *     a merge.
   *   - Don't consider it a merge conflict if the element analysis indicates
   *     that declarations are mutually exclusive on the same element.
   *   - Some shorthands may merge better (or at all) with one segment than
   *     another.
   *
   * @param actions The current {{OptimizationPass}} actions.
   * @param mapper The declaration map information for the current pass.
   * @param declInfos information about the declarations that can be merged.
   *   These must be in order of lowest to highest precedence.
   * @returns groups of {{DeclarationInfo}}s that should be merged together.
   */
  private segmentByCascadeConflicts(
    actions: Actions,
    mapper: DeclarationMapper,
    mergables: Array<MergableDeclarationSet>
  ): Array<Array<MergableDeclarationSet>> {
    /** All mergables for the current context */
    let contextMergables = new Array<Array<MergableDeclarationSet>>();
    for (let mergeable of mergables) {
      /** All mergables for the current context and mergable property but separated by cascade divisions */
      let segmentedMergables = new Array<MergableDeclarationSet>();
      let declInfos = mergeable.decls;
      if (declInfos.length === 0) {
        continue;
      }
      let props = expandPropertyName(declInfos[0].prop);
      let expanded = expandIfNecessary(new Set(props), declInfos[0].prop, declInfos[0].value);

      nextMerge:
      for (let unmergedDecl of declInfos) {
        nextGroup:
        for (let segment of segmentedMergables) {
          for (let mergedDecl of segment.decls) {
            let conflict = isMergeConflicted(mapper, props, expanded, unmergedDecl, mergedDecl);
            if (conflict) {
              actions.perform(conflict);
              continue nextGroup;
            }
          }
          segment.decls.push(unmergedDecl);
          continue nextMerge;
        }
        segmentedMergables.push({
          context: mergeable.context,
          decl: mergeable.decl,
          decls: new Array<DeclarationInfo>(unmergedDecl)
        });
      }
      for (let segment of segmentedMergables) {
        for (let declInfo of segment.decls) {
          declInfo.dupeCount = segment.decls.length - 1;
        }
      }
    contextMergables.push(segmentedMergables);
    }

    return contextMergables;
  }
}

function isMergeConflicted(
  mapper: DeclarationMapper,
  props: string[],
  expanded: StringDict,
  unmergedDecl: DeclarationInfo,
  mergedDecl: DeclarationInfo
): AnnotateMergeConflict | undefined {
  for (let element of unmergedDecl.selectorInfo.elements) {
    let elInfo = mapper.elementDeclarations.get(element);
    if (!elInfo) continue;
    for (let prop of props) {
      let conflictDecls = elInfo.getValue(prop); // TODO: check if the decls are applied in conjunction or if they are exclusive from each other.
      for (let conflictDecl of conflictDecls) {
        if (expanded[prop] !== conflictDecl.value // TODO: What if the conflict decl is a shorthand?
            && declBetween(mergedDecl, conflictDecl, unmergedDecl)) {
          return mergeConflict(mergedDecl, unmergedDecl, conflictDecl, element);
        }
      }
    }
  }
  return;
}

function declBetween(
  outside1: DeclarationInfo,
  between: DeclarationInfo,
  outside2: DeclarationInfo
) {
  let lowerOrdinal = Math.min(outside1.ordinal, outside2.ordinal);
  let upperOrdinal = Math.max(outside1.ordinal, outside2.ordinal);
  return lowerOrdinal < between.ordinal && upperOrdinal > between.ordinal;
}

function canMerge(mapper: DeclarationMapper, decl: postcss.Declaration): boolean {
  if (!propParser.isShorthandProperty(decl.prop)) {
    return true;
  }
  let infos = mapper.shortHands.get(decl);
  if (infos) {
    let duplicateCount = infos.reduce((total, info) => total + Math.min(info.dupeCount, 1), 0);
    return duplicateCount >= Math.ceil(infos.length / 2) + 1;
  } else {
    throw new Error("Missing decl info for declaration! " + inspect(decl));
  }
}

function mergeConflict(
  mergedDecl: DeclarationInfo,
  unmergedDecl: DeclarationInfo,
  conflictDecl: DeclarationInfo,
  element: Element
): AnnotateMergeConflict {
  return new AnnotateMergeConflict(
    mergedDecl.decl, mergedDecl.selectorInfo.selector,
    unmergedDecl.decl, unmergedDecl.selectorInfo.selector,
    conflictDecl.decl, conflictDecl.selectorInfo.selector,
    element
  );
}

function mergedShorthandsForContext(contextMergables: MergableDeclarationSet[]) {
  let shorthands = new Set<postcss.Declaration>();
  for (let mergable of contextMergables) {
    for (let declInfo of mergable.decls) {
      if (declInfo.decl.prop !== declInfo.prop) {
        shorthands.add(declInfo.decl);
      }
    }
  }
  return shorthands;
}
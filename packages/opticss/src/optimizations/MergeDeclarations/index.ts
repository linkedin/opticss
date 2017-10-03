import {
  MarkAttributeValueObsolete,
} from '../../actions/MarkAttributeValueObsolete';
import {
  allParsedSelectors,
  ParsedSelectorAndRule,
  QuerySelectorReferences,
} from '../../query';
import {
  IdentityDictionary,
  StringDict,
} from '@opticss/util';
import {
  SimpleAttribute,
  simpleAttributeToString,
  TemplateAnalysis,
  TemplateTypes,
  Attr,
  Attribute,
  AttributeNS,
  AttributeValueChoice,
  Element,
  isAbsent,
  isChoice,
  isConstant,
  Tagname,
  ValueAbsent,
  ValueConstant,
  TemplateIntegrationOptions,
} from '@opticss/template-api';
import {
  isClass,
  isIdentifier,
  ParsedSelector,
  isAttribute,
} from '../../parseSelector';
import {
  expandIfNecessary,
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
  MergeDeclarations as MergeDeclarationsAction, inputsFromSelector,
} from '../../actions/MergeDeclarations';
import {
  ParsedCssFile,
} from '../../CssFile';
import {
  Initializers,
} from '../../initializers';
import {
  OptiCSSOptions,
} from '../../OpticssOptions';
import {
  OptimizationPass,
} from '../../OptimizationPass';
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
import { Actions } from '../../Actions';
import { AnnotateMergeConflict } from '../../actions/AnnotateMergeConflict';
import { matchToBool, matches, AttributeMatcher } from '../../Match';

const attrMatcher = AttributeMatcher.instance;

interface MergeableDeclarationSet {
  context: OptimizationContext;
  decls: DeclarationInfo[];
  decl: {
    prop: string;
    value: string;
    important: boolean;
  };
}

export class MergeDeclarations implements MultiFileOptimization {
  name = "mergeDeclarations";
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
    let removedSelectors = new Array<ParsedSelectorAndRule>();
    for (let context of mapper.contexts) {
      let contextMergeables = this.mergeablesForContext(pass, context);
      let shorthands = mergedShorthandsForContext(contextMergeables);
      let segmentedContextMergeables = this.segmentByCascadeConflicts(pass.actions, context, mapper, contextMergeables);
      segmentedContextMergeables = this.checkAndExpandShorthands(pass, mapper, shorthands, segmentedContextMergeables);
      for (let mergeableSets of segmentedContextMergeables) {
        for (let mergeableSet of mergeableSets) {
          if (mergeableSet.decls.length < 2) continue;
          let removed = this.mergeDeclarationSet(pass, mergeableSet);
          removedSelectors.splice(0, 0, ...removed);
        }
      }
    }
    let unusedAttrs = this.findUnusedAttributes(files, removedSelectors);
    for (let unusedAttr of unusedAttrs) {
      let referencedSelectors = removedSelectors.filter(sel => matches(attrMatcher.matchSelector(unusedAttr, sel.parsedSelector, true)));
      let attr: SimpleAttribute = {
        ns: unusedAttr.namespaceURL || undefined,
        name: unusedAttr.name,
        value: isConstant(unusedAttr.value) ? unusedAttr.value.constant : ""
      };
      pass.actions.perform(new MarkAttributeValueObsolete(pass, referencedSelectors, attr, "All selectors referencing it were removed."));
    }
  }
  private isMergeable(options: TemplateIntegrationOptions, pass: OptimizationPass, declInfo: DeclarationInfo): boolean {
    let rule: postcss.Rule = <postcss.Rule>declInfo.decl.parent;
    let parsedSelectors = pass.cache.getParsedSelectors(rule);
    for (let sel of parsedSelectors) {
      let kSel = sel.key;
      if (!inputsFromSelector(options, kSel)) {
        return false;
      }
    }
    return true;
  }
  /**
   * Returns all the sets of mergeable declaration sets that exist in the given
   * optimization context. The sets returned from this method do not
   * respect the cascade or take into account whether the merge would be a net
   * benefit.
   */
  private mergeablesForContext(pass: OptimizationPass, context: OptimizationContext) {
    let contextMergeables = new Array<MergeableDeclarationSet>();
    for (let prop of context.declarationMap.keys()) {
      let values = context.declarationMap.getValue(prop);
      for (let value of values.keys()) {
        let decls = values.getValue(value);
        decls = decls.filter(d => this.isMergeable(this.templateOptions, pass, d));
        let importantDecls = decls.filter(d => d.important);
        let normalDecls = decls.filter(d => !d.important);
        if (importantDecls.length > 1) {
          contextMergeables.push({
            context,
            decls: importantDecls,
            decl: { prop, value, important: true }
          });
        }
        if (normalDecls.length > 1) {
          contextMergeables.push({
            context,
            decls: normalDecls,
            decl: { prop, value, important: false }
          });
        }
      }
    }
    return contextMergeables;
  }
  // TODO: consider extracting this out to it's own optimization and base it on the
  // analysis instead of the attributes that were removed? This would catch
  // unused attributes in the template -- but maybe that's too aggressive to rely on
  // and would end up disabled. In theory, if we had that this could run only
  // when that optimization is disabled and they could share a single impl.
  private findUnusedAttributes(files: Array<ParsedCssFile>, removedSelectors: Array<ParsedSelectorAndRule>): Array<Attr> {
    let attrs = attrsForSelectors(removedSelectors);
    // construct an analysis element that is a choice of all attrs that were in
    // removed selectors. that will allow use to query each stylesheet only
    // once and find selectors that are still using them.
    let attrGroups = groupAttrsByName(attrs);
    let elementAttributes = new Array<Attr>();
    for (let group of attrGroups) {
      // Removing an attribute is part of rewriting.
      // We only rewrite ids and classes for now but if we allow others
      // they'll probably be enumerated in the `rewriteIdents` object.
      if (group.ns || !this.templateOptions.rewriteIdents[group.name]) {
        continue;
      }
      let values: AttributeValueChoice = {oneOf: group.values!.map(v => v ? <ValueConstant>{constant: v} : <ValueAbsent>{absent: true})};
      if (group.ns) { // this never happens right now -- handled for completeness.
        elementAttributes.push(new AttributeNS(group.ns, group.name, values));
      } else {
        elementAttributes.push(new Attribute(group.name, values));
      }
    }
    let element = new Element(new Tagname({unknown: true}), elementAttributes);

    // Run the query and collect all selectors that are using at least one
    // of the attributes that might be in use.
    let query = new QuerySelectorReferences([element]);
    let foundSelectors = new Array<ParsedSelector>();
    for (let file of files) {
      let result = query.execute(file.content.root!);
      foundSelectors.splice(0, 0, ...allParsedSelectors(result));
    }

    // Now we transform our single element into a set of attributes with one
    // value each and figure out which of those aren't being used in the selectors
    // that matched our query.
    let attrsToRemove = new Array<Attr>();
    for (let elAttr of element.attributes) {
      let value = elAttr.value;
      if (!isChoice(value)) continue; // this makes the type checker happy
      let attrs = new Set(value.oneOf.map(v => {
        if (elAttr.namespaceURL) {
          return new AttributeNS(elAttr.namespaceURL, elAttr.name, v);
        } else {
          return new Attribute(elAttr.name, v);
        }
      }));
      for (let foundSelector of foundSelectors) {
        for (let attr of attrs) {
          let match = attrMatcher.matchSelector(attr, foundSelector, false);
          if (matchToBool(match)) {
            attrs.delete(attr); // once it matches one selector we can remove it.
          }
        }
        if (attrs.size === 0) break; // from the selectors a bit early if possible.
      }
      for (let unusedAttr of attrs) {
        if (isConstant(unusedAttr.value)) {
          attrsToRemove.push(unusedAttr);
        } else if (isAbsent(unusedAttr.value)) {
          // TODO: we can remove this attribute on all elements when it has no
          // value.
        } else {
          throw new Error("unsupported value: " + inspect(unusedAttr.value));
        }
      }
    }
    return attrsToRemove;
  }
  /**
   * Merges a set of mergeable declarations and updates the state of the
   * declaration data accordingly.
   * @param mergeableDeclarations A set of declarations that should be merged.
   * @returns ParsedSelectors that were removed
   */
  private mergeDeclarationSet(
    pass: OptimizationPass,
    mergeableDeclarations: MergeableDeclarationSet
  ): Array<ParsedSelectorAndRule> {
    let context = mergeableDeclarations.context;
    let declInfos = mergeableDeclarations.decls;
    let decl = mergeableDeclarations.decl;
    let scope = context.scopes[0];
    let container = scope.length > 0 ? scope[scope.length - 1] : context.root;
    let action = new MergeDeclarationsAction(
      this.templateOptions,
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
      "Duplication");
    pass.actions.perform(action);
    // The declarations are inserted at the document location of the first declaration it
    // is merged with. So we update its declarations to that ordinal value.
    let newOrdinal = declInfos[0].ordinal;
    for (let i = 1; i < declInfos.length; i++) {
      declInfos[i].ordinal = newOrdinal;
    }
    return action.removedSelectors;
  }

  private checkAndExpandShorthands(
    pass: OptimizationPass,
    mapper: DeclarationMapper,
    shorthands: Set<postcss.Declaration>,
    mergeableSets: MergeableDeclarationSet[][]
  ): MergeableDeclarationSet[][] {
    let mergeableShorthands = new Set<postcss.Declaration>();
    let unmergeableShorthands = new Set<postcss.Declaration>();
    for (let shorthand of shorthands) {
      if (canMerge(mapper, shorthand)) {
        mergeableShorthands.add(shorthand);
      } else {
        unmergeableShorthands.add(shorthand);
      }
    }
    let mergedLonghands = new Set<DeclarationInfo>();
    for (let segments of mergeableSets) {
      for (let mergeableSet of segments) {
        for (let declInfo of mergeableSet.decls) {
          if (mergeableSet.decls.length > 1 && mergeableShorthands.has(declInfo.decl)) {
            mergedLonghands.add(declInfo);
          } else if (unmergeableShorthands.has(declInfo.decl)) {
            mergeableSet.decls.splice(mergeableSet.decls.indexOf(declInfo), 1);
            mergeableSet.decls.forEach(d => {d.dupeCount = d.dupeCount - 1;});
            declInfo.dupeCount = 0;
          }
        }
      }
    }
    for (let mergeableShorthand of mergeableShorthands) {
      let infos = mapper.shortHands.get(mergeableShorthand);
      if (infos) {
        let toExpand = infos.filter(i => !mergedLonghands.has(i));
        pass.actions.perform(new ExpandShorthand(mergeableShorthand, toExpand, "mergeDeclarations", "one or more of the long hand values was not duplicated anywhere."));
      }
    }
    return mergeableSets;
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
    context: OptimizationContext,
    mapper: DeclarationMapper,
    mergeables: Array<MergeableDeclarationSet>
  ): Array<Array<MergeableDeclarationSet>> {
    /** All mergeables for the current context */
    let contextMergeables = new Array<Array<MergeableDeclarationSet>>();
    for (let mergeable of mergeables) {
      /** All mergeables for the current context and mergeable property but separated by cascade divisions */
      let segmentedMergeables = new Array<MergeableDeclarationSet>();
      let declInfos = mergeable.decls;
      if (declInfos.length === 0) {
        continue;
      }
      let expanded = expandIfNecessary(context.authoredProps, declInfos[0].prop, declInfos[0].value);

      nextMerge:
      for (let unmergedDecl of declInfos) {
        nextGroup:
        for (let segment of segmentedMergeables) {
          for (let mergedDecl of segment.decls) {
            let conflict = isMergeConflicted(mapper, Object.keys(expanded), expanded, unmergedDecl, mergedDecl);
            if (conflict) {
              actions.perform(conflict);
              continue nextGroup;
            }
          }
          segment.decls.push(unmergedDecl);
          continue nextMerge;
        }
        segmentedMergeables.push({
          context: mergeable.context,
          decl: mergeable.decl,
          decls: new Array<DeclarationInfo>(unmergedDecl)
        });
      }
      for (let segment of segmentedMergeables) {
        for (let declInfo of segment.decls) {
          declInfo.dupeCount = segment.decls.length - 1;
        }
      }
      contextMergeables.push(segmentedMergeables);
    }

    return contextMergeables;
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

const operatorsDescribingIdents = ["=", "~=", undefined];

function attrsForSelectors(selectors: ParsedSelectorAndRule[]): IdentityDictionary<SimpleAttribute> {
  let attributes = new IdentityDictionary<SimpleAttribute>(simpleAttributeToString);
  for (let selector of selectors) {
    selector.parsedSelector.eachSelectorNode(node => {
      if (isClass(node)) {
        attributes.add({name: "class", value: node.value});
      } else if (isIdentifier(node)) {
        attributes.add({name: "id", value: node.value});
      } else if (isAttribute(node)) {
        if (operatorsDescribingIdents.includes(node.operator)) {
          let attr: SimpleAttribute = {
            ns: node.ns,
            name: node.attribute,
            value: node.value || ""
          };
          attributes.add(attr);
        }
      }
    });
  }
  return attributes;
}

interface AttrGroup {
  ns: string | undefined;
  name: string;
  values?: Array<string | undefined>;
}

function groupAttrsByName(attrs: IdentityDictionary<SimpleAttribute>): IdentityDictionary<AttrGroup> {
  let groupDictionary = new IdentityDictionary<AttrGroup>((v => `${v.ns}|${v.name}`));
  for (let attr of attrs) {
    let group = groupDictionary.add({ns: attr.ns, name: attr.name});
    if (!group.values) group.values = [];
    group.values.push(attr.value);
  }
  return groupDictionary;
}

function mergedShorthandsForContext(contextMergeables: MergeableDeclarationSet[]) {
  let shorthands = new Set<postcss.Declaration>();
  for (let mergeable of contextMergeables) {
    for (let declInfo of mergeable.decls) {
      if (declInfo.decl.prop !== declInfo.prop) {
        shorthands.add(declInfo.decl);
      }
    }
  }
  return shorthands;
}
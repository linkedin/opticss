import {
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
} from "@opticss/element-analysis";
import {
  isSimpleTagname,
  SimpleAttribute,
  simpleAttributeToString,
  TemplateAnalysis,
  TemplateIntegrationOptions,
  TemplateTypes,
} from "@opticss/template-api";
import {
  IdentityDictionary,
  MultiMap,
  StringDict,
  TwoKeyMultiMap,
} from "@opticss/util";
import * as propParser from "css-property-parser";
import * as postcss from "postcss";
import { isAttribute, isClassName, isIdentifier } from "postcss-selector-parser";
import * as specificity from "specificity";
import {
  inspect,
} from "util";

import {
  Actions,
  AnnotateMergeConflict,
  ChangeSelector,
  ExpandShorthand,
  MarkAttributeValueObsolete,
  MergeDeclarations as MergeDeclarationsAction,
} from "../../Actions";
import {
  ParsedCssFile,
} from "../../CssFile";
import { AttributeMatcher, matches, matchToBool } from "../../Match";
import {
  OptiCSSOptions,
} from "../../OpticssOptions";
import {
  OptimizationPass,
} from "../../OptimizationPass";
import {
  Initializers,
} from "../../initializers";
import {
  ParsedSelector,
} from "../../parseSelector";
import {
  allParsedSelectors,
  ParsedSelectorAndRule,
  QuerySelectorReferences,
} from "../../query";
import { isDeclaration } from "../../util/cssIntrospection";
import {
  expandIfNecessary,
} from "../../util/shorthandProperties";
import {
  MultiFileOptimization,
} from "../Optimization";

import {
  DeclarationMapper,
} from "./DeclarationMapper";
import {
  OptimizationContext,
} from "./OptimizationContext";
import {
  DeclarationInfo, SelectorInfo,
} from "./StyleInfo";

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

  private templateOptions: TemplateIntegrationOptions;
  constructor(_options: OptiCSSOptions, templateOptions: TemplateIntegrationOptions) {
    this.templateOptions = templateOptions;
  }
  optimizeAllFiles(
    pass: OptimizationPass,
    analyses: Array<TemplateAnalysis<keyof TemplateTypes>>,
    files: Array<ParsedCssFile>,

  ): void {
    let mapper = new DeclarationMapper(pass, analyses, files);
    // TODO: First step needs to be a stable sort of the stylesheet by specificity in a way that never introduces a conflict.
    // This is complicated because a ruleset can have multiple selectors with different specificities (usually the case, when there's)
    let removedSelectors = new Array<ParsedSelectorAndRule>();
    let segmentedMergeablesForContext = new Map<OptimizationContext, MergeableDeclarationSet[][]>();
    for (let context of mapper.contexts) {
      let contextMergeables = this.mergeablesForContext(pass, context);
      let segmentedContextMergeables = this.segmentByCascadeConflicts(pass.actions, context, mapper, contextMergeables);
      segmentedMergeablesForContext.set(context, segmentedContextMergeables);
    }
    let rulesNeedingSelectorPruning = this.checkDupesAndExpandShorthands(pass, mapper, segmentedMergeablesForContext);
    for (let context of mapper.contexts) {
      let segmentedContextMergeables = segmentedMergeablesForContext.get(context)!;
      for (let mergeableSets of segmentedContextMergeables) {
        for (let mergeableSet of mergeableSets) {
          if (mergeableSet.decls.length < 2) continue;
          let removed = this.mergeDeclarationSet(pass, mergeableSet);
          removedSelectors.splice(0, 0, ...removed);
        }
      }
    }
    removedSelectors.push(...this.removeFullyMergedSelectors(pass, mapper, rulesNeedingSelectorPruning));
    let unusedAttrs = this.findUnusedAttributes(files, removedSelectors);
    for (let unusedAttr of unusedAttrs) {
      let referencedSelectors = removedSelectors.filter(sel => matches(attrMatcher.matchSelector(unusedAttr, sel.parsedSelector, true)));
      let attr: SimpleAttribute = {
        ns: unusedAttr.namespaceURL || undefined,
        name: unusedAttr.name,
        value: isConstant(unusedAttr.value) ? unusedAttr.value.constant : "",
      };
      pass.actions.perform(new MarkAttributeValueObsolete(pass, referencedSelectors, attr, "All selectors referencing it were removed."));
    }
  }
  private isMergeable(options: TemplateIntegrationOptions, pass: OptimizationPass, declInfo: DeclarationInfo): boolean {
    let rule: postcss.Rule = <postcss.Rule>declInfo.decl.parent;
    if (!rule) return false; // TODO: we should probably keep the data structure in sync?
    let parsedSelectors = pass.cache.getParsedSelectors(rule);
    for (let sel of parsedSelectors) {
      let kSel = sel.key;
      let inputs = MergeDeclarationsAction.inputsFromSelector(options, kSel);
      if (!inputs) {
        return false;
      }
      if (inputs.every(i => isSimpleTagname(i))) {
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
      let values = context.declarationMap.getValue(prop)!;
      for (let value of values.keys()) {
        let decls = values.getValue(value);
        decls = decls.filter(d => this.isMergeable(this.templateOptions, pass, d));
        let importantDecls = decls.filter(d => d.important);
        let normalDecls = decls.filter(d => !d.important);
        if (importantDecls.length > 1) {
          contextMergeables.push({
            context,
            decls: importantDecls,
            decl: { prop, value, important: true },
          });
        }
        if (normalDecls.length > 1) {
          contextMergeables.push({
            context,
            decls: normalDecls,
            decl: { prop, value, important: false },
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
    mergeableDeclarations: MergeableDeclarationSet,

  ): Array<ParsedSelectorAndRule> {
    let context = mergeableDeclarations.context;
    let declInfos = mergeableDeclarations.decls;
    let decl = mergeableDeclarations.decl;
    let action = new MergeDeclarationsAction(
      this.templateOptions,
      pass,
      context.selectorContext,
      decl,
      declInfos,
      "mergeDeclarations",
      "Duplication");
    pass.actions.perform(action);
    return action.removedSelectors;
  }

  private checkDupesAndExpandShorthands(
    pass: OptimizationPass,
    mapper: DeclarationMapper,
    mergeableSetsPerContext: Map<OptimizationContext, MergeableDeclarationSet[][]>,

  ): MultiMap<postcss.Rule, [OptimizationContext, postcss.Declaration]> {
    let mergedDecls = new Set<DeclarationInfo>();
    let unmergedDecls = new Set<DeclarationInfo>();
    let mergedLongHands = new MultiMap<OptimizationContext, DeclarationInfo>(false);
    let needsAnotherCheck = true;
    // This algorithm fucking sucks.
    while (needsAnotherCheck) {
      needsAnotherCheck = false;
      let mergeableMemo = new Map<postcss.Declaration, boolean>();
      for (let [context, mergeableSets] of mergeableSetsPerContext) {
      for (let segments of mergeableSets) {
        for (let mergeableSet of segments) {
          for (let declInfo of mergeableSet.decls) {
            if (unmergedDecls.has(declInfo)) continue;
            if (mergeableSet.decls.length <= 1) continue;
            if (canMerge(mergeableMemo, mapper, declInfo.decl)) {
              mergedDecls.add(declInfo);
              if (declInfo.prop !== declInfo.decl.prop) {
                mergedLongHands.set(context, declInfo);
              }
            } else {
              needsAnotherCheck = true;
              mergedDecls.delete(declInfo); // in case it was added on a prev iteration.
              mergedLongHands.deleteValue(mergeableSet.context, declInfo); // in case it was added on a prev iteration.
              unmergedDecls.add(declInfo);
              declInfo.ordinal = declInfo.originalOrdinal;
              declInfo.sourceOrdinal = declInfo.originalSourceOrdinal;
              mergeableSet.decls.splice(mergeableSet.decls.indexOf(declInfo), 1);
              mergeableSet.decls.forEach(d => { d.dupeCount = d.dupeCount - 1; });
              declInfo.dupeCount = 0;
            }
          }
        }
      }
      }
    }
    let mergedPropsPerContext = new Map<postcss.Declaration, MultiMap<OptimizationContext, string>>();
    for (let [context, lhDecls] of mergedLongHands) {
      for (let lhDecl of lhDecls) {
        let contextProps = mergedPropsPerContext.get(lhDecl.decl);
        if (!contextProps) {
          contextProps = new MultiMap<OptimizationContext, string>(false);
          mergedPropsPerContext.set(lhDecl.decl, contextProps);
        }
        contextProps.set(context, lhDecl.prop);
      }
    }

    let rulesMaybeFullyMerged = new MultiMap<postcss.Rule, [OptimizationContext, postcss.Declaration]>();
    for (let [shortHand, contextProps] of mergedPropsPerContext) {
      let infoSets = mapper.declarationInfos.get(shortHand);
      let declsToExpand = new Array<DeclarationInfo>();
      for (let [context, props] of contextProps) {
        for (let infos of infoSets) {
          if (!context.declarationInfos.has(infos[0])) continue;
          let hasExpansion = false;
          for (let declInfo of infos) {
            if (props.includes(declInfo.prop)) continue;
            hasExpansion = true;
            declsToExpand.push(declInfo);
          }
          if (!hasExpansion) {
            rulesMaybeFullyMerged.set(<postcss.Rule>infos[0].decl.parent, [context, infos[0].decl]);
          }
        }
      }
      if (declsToExpand.length > 0) {
        pass.actions.perform(new ExpandShorthand(shortHand, declsToExpand, "mergeDeclarations", "one or more of the long hand values was not duplicated in at least one merge context."));
      }
    }
    return rulesMaybeFullyMerged;
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
    mergeables: Array<MergeableDeclarationSet>,

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
      let expanded = expandIfNecessary(context.authoredProps, declInfos[0].prop, declInfos[0].value, actions);
      nextMerge:
      for (let unmergedDecl of declInfos) {
        nextGroup:
        for (let segment of segmentedMergeables) {
          for (let mergedDecl of segment.decls) {
            // TODO: This assumes that merge always moves to the position of the
            // first decl in the segment. but sometimes we can move the merge
            // location to create a merge that succeeds. we can move the merge
            // point to the new merge location or sometimes to just before the
            // selector that would conflict on an element but after another
            // selector that would cause a conflict if before it.
            //
            // TODO: In other cases we can perform a merge by extracting a
            // conflicting declaration to it's own selector and linking it as if
            // it were merged, and then record that class as exclusive with the
            // merged decl so the cascade is preserved.
            let conflict = isMergeConflicted(mapper, Object.keys(expanded), expanded, unmergedDecl, mergedDecl, context.specificity);
            if (conflict) {
              actions.perform(conflict);
              continue nextGroup;
            }
          }
          if (segment.decls.length > 0) {
            unmergedDecl.ordinal = segment.decls[0].ordinal;
            unmergedDecl.sourceOrdinal = segment.decls[0].sourceOrdinal;
          }
          segment.decls.push(unmergedDecl);
          continue nextMerge;
        }
        segmentedMergeables.push({
          context: mergeable.context,
          decl: mergeable.decl,
          decls: new Array<DeclarationInfo>(unmergedDecl),
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

  removeFullyMergedSelectors(pass: OptimizationPass, mapper: DeclarationMapper, rulesNeedingSelectorPruning: MultiMap<postcss.Rule, [OptimizationContext, postcss.Declaration]>): Array<ParsedSelectorAndRule> {
    let removedSelectors = new Array<ParsedSelectorAndRule>();
    let shortHandsForRule = new MultiMap<postcss.Rule, postcss.Declaration>();
    // let contextsForRule = new MultiMap<postcss.Rule, OptimizationContext>();
    let longHands = new TwoKeyMultiMap<string, string, string>(false);
    for (let [rule, values] of rulesNeedingSelectorPruning) {
      for (let value of values) {
        let decl = value[1];
        shortHandsForRule.set(rule, decl);
        let expanded = propParser.expandShorthandProperty(decl.prop, decl.value, true, true);
        for (let exProp of Object.keys(expanded)) {
          longHands.set(decl.prop, exProp, expanded[exProp]);
        }
      }
    }
    nextRule:
    for (let rule of rulesNeedingSelectorPruning.keys()) {
      if (!rule.parent) continue;
      // can't remove a selector if there's properties in this rule that aren't from a shorthand expansion.
      for (let node of rule.nodes!) {
        if (isDeclaration(node)) {
          for (let shortHand of shortHandsForRule.get(rule)) {
            if (!longHands.hasValue(shortHand.prop, node.prop, node.value)) {
              continue nextRule;
            }
          }
        }
      }
      // let contexts = contextsForRule.get(rule);
      let shorthands = shortHandsForRule.get(rule);
      let unusedSelectors = new Set<SelectorInfo>();
      let selectorsInUse = new Set<SelectorInfo>();
      for (let shorthand of shorthands) {
        let infoSets = mapper.declarationInfos.get(shorthand);
        for (let infos of infoSets) {
          if (infos.length < 2) continue;
          let selectorInfo = infos[0].selectorInfo;
          if (infos.every(decl => !decl.expanded)
              && !selectorsInUse.has(selectorInfo)) {
            unusedSelectors.add(selectorInfo);
          } else {
            unusedSelectors.delete(selectorInfo); // In case it was previously added for a different shorthand.
            selectorsInUse.add(selectorInfo);
          }
        }
      }
      if (unusedSelectors.size > 0) {
        let unusedSelector = unusedSelectors.keys().next().value;
        pass.actions.perform(new ChangeSelector(unusedSelector.rule, [...selectorsInUse].map(si => si.selector).join(", "), "mergeDeclarations", "was merged into other rules", pass.cache));
        for (let unusedSelector of unusedSelectors) {
          removedSelectors.push({
            rule,
            parsedSelector: unusedSelector.selector,
          });
        }
      }
    }
    return removedSelectors;
  }
}

function isMergeConflicted(
  mapper: DeclarationMapper,
  props: string[],
  expanded: StringDict,
  unmergedDecl: DeclarationInfo,
  mergedDecl: DeclarationInfo,
  targetSpecificity: specificity.Specificity | undefined,

): AnnotateMergeConflict | undefined {
  for (let element of unmergedDecl.selectorInfo.elements) {
    let elInfo = mapper.elementDeclarations.get(element);
    if (!elInfo) continue;
    let allProps = new Set<string>(props);
    for (let prop of props) {
      for (let shorthand of propParser.getShorthandsForProperty(prop)) {
        allProps.add(shorthand);
      }
    }

    for (let prop of allProps) {
      let conflictDecls = elInfo.getValue(prop); // TODO: check if the decls are applied in conjunction or if they are exclusive from each other.
      for (let conflictDecl of conflictDecls) {
        if (expanded[prop] !== conflictDecl.value // TODO: What if the conflict decl is a shorthand?
            && checkForConflict(mergedDecl, conflictDecl, unmergedDecl, targetSpecificity)) {
          return mergeConflict(mergedDecl, unmergedDecl, conflictDecl, element);
        }
      }
    }
  }
  return;
}

function sameSpecificity(
  s1: specificity.Specificity,
  s2: specificity.Specificity,

) {
  return specificity.compare(s1.specificityArray, s2.specificityArray) === 0;
}

function checkForConflict(
  targetDecl: DeclarationInfo,
  isConflictDecl: DeclarationInfo,
  fromDecl: DeclarationInfo,
  targetSpecificity: specificity.Specificity | undefined,

): boolean {
  if (targetSpecificity
      && !sameSpecificity(targetSpecificity,
                          isConflictDecl.selectorInfo.specificity)) {
    return false; // document order only matters if they have the same specificity.
  }
  // if the possible conflict declaration isn't crossed then it can't conflict.
  if ((fromDecl.sourceOrdinal < isConflictDecl.sourceOrdinal
        && targetDecl.sourceOrdinal < fromDecl.sourceOrdinal)
      || (targetDecl.sourceOrdinal > isConflictDecl.sourceOrdinal
        && fromDecl.sourceOrdinal > targetDecl.sourceOrdinal)) {
    return false;
  }
  return true;
}

function canMerge(memo: Map<postcss.Declaration, boolean>, mapper: DeclarationMapper, decl: postcss.Declaration): boolean {
  if (memo.has(decl)) return memo.get(decl)!;
  let infoSets = mapper.declarationInfos.get(decl);
  let result = infoSets.every(infos => {
    if (infos.length === 1) return infos[0].dupeCount > 0;
    let duplicateCount = infos.reduce((total, info) => total + (info.dupeCount > 0 ? 1 : 0), 0);
    return duplicateCount > Math.ceil(infos.length / 2);
  });
  memo.set(decl, result);
  return result;
}

function mergeConflict(
  mergedDecl: DeclarationInfo,
  unmergedDecl: DeclarationInfo,
  conflictDecl: DeclarationInfo,
  element: Element,

): AnnotateMergeConflict {
  return new AnnotateMergeConflict(
    mergedDecl.decl, mergedDecl.selectorInfo.selector,
    unmergedDecl.decl, unmergedDecl.selectorInfo.selector,
    conflictDecl.decl, conflictDecl.selectorInfo.selector,
    element,
  );
}

const operatorsDescribingIdents = ["=", "~=", undefined];

function attrsForSelectors(selectors: ParsedSelectorAndRule[]): IdentityDictionary<SimpleAttribute> {
  let attributes = new IdentityDictionary<SimpleAttribute>(simpleAttributeToString);
  for (let selector of selectors) {
    selector.parsedSelector.eachSelectorNode(node => {
      if (isClassName(node)) {
        attributes.add({name: "class", value: node.value});
      } else if (isIdentifier(node)) {
        attributes.add({name: "id", value: node.value});
      } else if (isAttribute(node)) {
        if (operatorsDescribingIdents.includes(node.operator)) {
          let attr: SimpleAttribute = {
            ns: node.namespace && node.namespaceString,
            name: node.attribute,
            value: node.value || "",
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

[resolve-cascade](../README.md) > [ElementStyle](../classes/resolve_cascade.elementstyle.md)

# Class: ElementStyle

## Hierarchy

**ElementStyle**

## Index

### Constructors

* [constructor](resolve_cascade.elementstyle.md#constructor)

### Properties

* [dirty](resolve_cascade.elementstyle.md#dirty)
* [matchedSelectors](resolve_cascade.elementstyle.md#matchedselectors)

### Methods

* [add](resolve_cascade.elementstyle.md#add)
* [clean](resolve_cascade.elementstyle.md#clean)
* [compute](resolve_cascade.elementstyle.md#compute)
* [debug](resolve_cascade.elementstyle.md#debug)
* [pseudoElementStyle](resolve_cascade.elementstyle.md#pseudoelementstyle)
* [pseudoStates](resolve_cascade.elementstyle.md#pseudostates)
* [styledPseudoElements](resolve_cascade.elementstyle.md#styledpseudoelements)

---

## Constructors

<a id="constructor"></a>

### ⊕ **new ElementStyle**(): [ElementStyle](resolve_cascade.elementstyle.md)

*Defined in [src/Cascade.ts:46](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/Cascade.ts#L46)*

**Returns:** [ElementStyle](resolve_cascade.elementstyle.md)

---

## Properties

<a id="dirty"></a>

### `<Private>` dirty

**●  dirty**:  *`boolean`* 

*Defined in [src/Cascade.ts:46](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/Cascade.ts#L46)*

Track whether the selectors are out of order and need to be re-sorted;

___

<a id="matchedselectors"></a>

###  matchedSelectors

**●  matchedSelectors**:  *`Array`.<[MatchedSelector](../interfaces/resolve_cascade.matchedselector.md)>* 

*Defined in [src/Cascade.ts:42](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/Cascade.ts#L42)*

___

## Methods

<a id="add"></a>

###  add

▸ **add**(selector: *`string`*, rule: *`Rule`*, specificity: *`Specificity`*): `void`

*Defined in [src/Cascade.ts:67](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/Cascade.ts#L67)*

**Parameters:**

| Param | Type | Description |
| ------ | ------ | ------ |
| selector | `string`   |  - |
| rule | `Rule`   |  - |
| specificity | `Specificity`   |  - |

**Returns:** `void`

___

<a id="clean"></a>

### `<Private>` clean

▸ **clean**(): `void`

*Defined in [src/Cascade.ts:75](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/Cascade.ts#L75)*

**Returns:** `void`

___

<a id="compute"></a>

###  compute

▸ **compute**(): [ComputedStyle](../interfaces/resolve_cascade.computedstyle.md)

*Defined in [src/Cascade.ts:97](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/Cascade.ts#L97)*

**Returns:** [ComputedStyle](../interfaces/resolve_cascade.computedstyle.md)

___

<a id="debug"></a>

###  debug

▸ **debug**(): `string`

*Defined in [src/Cascade.ts:115](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/Cascade.ts#L115)*

**Returns:** `string`

___

<a id="pseudoelementstyle"></a>

###  pseudoElementStyle

▸ **pseudoElementStyle**(_name: *`string`*): [ElementStyle](resolve_cascade.elementstyle.md)

*Defined in [src/Cascade.ts:64](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/Cascade.ts#L64)*

**Parameters:**

| Param | Type | Description |
| ------ | ------ | ------ |
| _name | `string`   |  - |

**Returns:** [ElementStyle](resolve_cascade.elementstyle.md)

___

<a id="pseudostates"></a>

###  pseudoStates

▸ **pseudoStates**(): [PseudoStates](../interfaces/resolve_cascade.pseudostates.md)

*Defined in [src/Cascade.ts:54](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/Cascade.ts#L54)*

**Returns:** [PseudoStates](../interfaces/resolve_cascade.pseudostates.md)
All possible pseudo states for this element and related elements.

___

<a id="styledpseudoelements"></a>

###  styledPseudoElements

▸ **styledPseudoElements**(): [StyledPseudoElements](../interfaces/resolve_cascade.styledpseudoelements.md)

*Defined in [src/Cascade.ts:61](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/Cascade.ts#L61)*

**Returns:** [StyledPseudoElements](../interfaces/resolve_cascade.styledpseudoelements.md)
map of pseudo elements with styles to the computed style. The
name of the pseudo-element should not include the preceding colon(s).

___


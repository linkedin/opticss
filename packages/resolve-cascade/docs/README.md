
#  resolve-cascade

## Index

### Classes

* [Cascade](classes/resolve_cascade.cascade.md)
* [ElementStyle](classes/resolve_cascade.elementstyle.md)
* [ElementStyleMismatch](classes/resolve_cascade.elementstylemismatch.md)
* [MarkupMismatchError](classes/resolve_cascade.markupmismatcherror.md)

### Interfaces

* [AssertionResult](interfaces/resolve_cascade.assertionresult.md)
* [CascadeInformation](interfaces/resolve_cascade.cascadeinformation.md)
* [ComputedStyle](interfaces/resolve_cascade.computedstyle.md)
* [MatchedSelector](interfaces/resolve_cascade.matchedselector.md)
* [PseudoStates](interfaces/resolve_cascade.pseudostates.md)
* [StyledPseudoElements](interfaces/resolve_cascade.styledpseudoelements.md)

### Type aliases

* [FullCascade](#fullcascade)

### Functions

* [assertSameCascade](#assertsamecascade)
* [assertSameStyle](#assertsamestyle)
* [stylesForDeclaration](#stylesfordeclaration)

---

## Type aliases

<a id="fullcascade"></a>

###  FullCascade

**Τ FullCascade**:  *`Map`.<`Element`>,.<[ElementStyle](classes/resolve_cascade.elementstyle.md)>* 

*Defined in [src/Cascade.ts:149](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/Cascade.ts#L149)*

___

## Functions

<a id="assertsamecascade"></a>

###  assertSameCascade

▸ **assertSameCascade**(expectedCss: *`string`*, actualCss: *`string`*, expectedHtml: *`string`*, actualHtml: *`string`*): `Promise`.<[AssertionResult](interfaces/resolve_cascade.assertionresult.md)>

*Defined in [src/assertCascade.ts:110](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/assertCascade.ts#L110)*

**Parameters:**

| Param | Type | Description |
| ------ | ------ | ------ |
| expectedCss | `string`   |  - |
| actualCss | `string`   |  - |
| expectedHtml | `string`   |  - |
| actualHtml | `string`   |  - |

**Returns:** `Promise`.<[AssertionResult](interfaces/resolve_cascade.assertionresult.md)>

___

<a id="assertsamestyle"></a>

###  assertSameStyle

▸ **assertSameStyle**(property: *`string`*, actualValue: *`string`*, expectedValue: *`string`*): `void`

*Defined in [src/assertCascade.ts:82](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/assertCascade.ts#L82)*

This function makes sure two styles are functionally equivalent. for the given css property.

Currently this assures that initial values which can be different but functionally equivalent, are treated as the same value.

it also does a case insensitive value check and some whitespace normalization.

**Parameters:**

| Param | Type | Description |
| ------ | ------ | ------ |
| property | `string`   |  The css property |
| actualValue | `string`   |  a css value for the property |
| expectedValue | `string`   |  a css value for the property |

**Returns:** `void`

___

<a id="stylesfordeclaration"></a>

###  stylesForDeclaration

▸ **stylesForDeclaration**(decl: *`Declaration`*): [ComputedStyle](interfaces/resolve_cascade.computedstyle.md)

*Defined in [src/Cascade.ts:130](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/Cascade.ts#L130)*

**Parameters:**

| Param | Type | Description |
| ------ | ------ | ------ |
| decl | `Declaration`   |  - |

**Returns:** [ComputedStyle](interfaces/resolve_cascade.computedstyle.md)

___


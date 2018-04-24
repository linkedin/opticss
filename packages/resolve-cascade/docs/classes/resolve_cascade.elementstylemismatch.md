[resolve-cascade](../README.md) > [ElementStyleMismatch](../classes/resolve_cascade.elementstylemismatch.md)

# Class: ElementStyleMismatch

## Hierarchy

 `AssertionError`

**↳ ElementStyleMismatch**

## Implements

* `Error`
* [CascadeInformation](../interfaces/resolve_cascade.cascadeinformation.md)

## Index

### Constructors

* [constructor](resolve_cascade.elementstylemismatch.md#constructor)

### Properties

* [actual](resolve_cascade.elementstylemismatch.md#actual)
* [actualCascade](resolve_cascade.elementstylemismatch.md#actualcascade)
* [actualCss](resolve_cascade.elementstylemismatch.md#actualcss)
* [actualElement](resolve_cascade.elementstylemismatch.md#actualelement)
* [actualHtml](resolve_cascade.elementstylemismatch.md#actualhtml)
* [actualStyles](resolve_cascade.elementstylemismatch.md#actualstyles)
* [expected](resolve_cascade.elementstylemismatch.md#expected)
* [expectedCascade](resolve_cascade.elementstylemismatch.md#expectedcascade)
* [expectedCss](resolve_cascade.elementstylemismatch.md#expectedcss)
* [expectedElement](resolve_cascade.elementstylemismatch.md#expectedelement)
* [expectedHtml](resolve_cascade.elementstylemismatch.md#expectedhtml)
* [expectedStyles](resolve_cascade.elementstylemismatch.md#expectedstyles)
* [generatedMessage](resolve_cascade.elementstylemismatch.md#generatedmessage)
* [message](resolve_cascade.elementstylemismatch.md#message)
* [name](resolve_cascade.elementstylemismatch.md#name)
* [operator](resolve_cascade.elementstylemismatch.md#operator)

---

## Constructors

<a id="constructor"></a>

### ⊕ **new ElementStyleMismatch**(details: *[CascadeInformation](../interfaces/resolve_cascade.cascadeinformation.md)*, message?: *`undefined`⎮`string`*): [ElementStyleMismatch](resolve_cascade.elementstylemismatch.md)

*Overrides AssertionError.__constructor*

*Defined in [src/assertCascade.ts:57](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/assertCascade.ts#L57)*

**Parameters:**

| Param | Type | Description |
| ------ | ------ | ------ |
| details | [CascadeInformation](../interfaces/resolve_cascade.cascadeinformation.md)   |  - |
| message | `undefined`⎮`string`   |  - |

**Returns:** [ElementStyleMismatch](resolve_cascade.elementstylemismatch.md)

---

## Properties

<a id="actual"></a>

###  actual

**●  actual**:  *`any`* 

*Inherited from AssertionError.actual*

*Defined in /Users/ceppstei/Work/sailfish/opticss/node_modules/@types/node/index.d.ts:5559*

___

<a id="actualcascade"></a>

###  actualCascade

**●  actualCascade**:  *[ElementStyle](resolve_cascade.elementstyle.md)* 

*Implementation of [CascadeInformation](../interfaces/resolve_cascade.cascadeinformation.md).[actualCascade](../interfaces/resolve_cascade.cascadeinformation.md#actualcascade)*

*Defined in [src/assertCascade.ts:55](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/assertCascade.ts#L55)*

___

<a id="actualcss"></a>

###  actualCss

**●  actualCss**:  *`string`* 

*Implementation of [CascadeInformation](../interfaces/resolve_cascade.cascadeinformation.md).[actualCss](../interfaces/resolve_cascade.cascadeinformation.md#actualcss)*

*Defined in [src/assertCascade.ts:53](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/assertCascade.ts#L53)*

___

<a id="actualelement"></a>

###  actualElement

**●  actualElement**:  *`string`* 

*Implementation of [CascadeInformation](../interfaces/resolve_cascade.cascadeinformation.md).[actualElement](../interfaces/resolve_cascade.cascadeinformation.md#actualelement)*

*Defined in [src/assertCascade.ts:51](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/assertCascade.ts#L51)*

___

<a id="actualhtml"></a>

###  actualHtml

**●  actualHtml**:  *`string`* 

*Implementation of [CascadeInformation](../interfaces/resolve_cascade.cascadeinformation.md).[actualHtml](../interfaces/resolve_cascade.cascadeinformation.md#actualhtml)*

*Defined in [src/assertCascade.ts:49](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/assertCascade.ts#L49)*

___

<a id="actualstyles"></a>

###  actualStyles

**●  actualStyles**:  *[ComputedStyle](../interfaces/resolve_cascade.computedstyle.md)⎮`undefined`* 

*Implementation of [CascadeInformation](../interfaces/resolve_cascade.cascadeinformation.md).[actualStyles](../interfaces/resolve_cascade.cascadeinformation.md#actualstyles)*

*Defined in [src/assertCascade.ts:57](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/assertCascade.ts#L57)*

___

<a id="expected"></a>

###  expected

**●  expected**:  *`any`* 

*Inherited from AssertionError.expected*

*Defined in /Users/ceppstei/Work/sailfish/opticss/node_modules/@types/node/index.d.ts:5560*

___

<a id="expectedcascade"></a>

###  expectedCascade

**●  expectedCascade**:  *[ElementStyle](resolve_cascade.elementstyle.md)* 

*Implementation of [CascadeInformation](../interfaces/resolve_cascade.cascadeinformation.md).[expectedCascade](../interfaces/resolve_cascade.cascadeinformation.md#expectedcascade)*

*Defined in [src/assertCascade.ts:54](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/assertCascade.ts#L54)*

___

<a id="expectedcss"></a>

###  expectedCss

**●  expectedCss**:  *`string`* 

*Implementation of [CascadeInformation](../interfaces/resolve_cascade.cascadeinformation.md).[expectedCss](../interfaces/resolve_cascade.cascadeinformation.md#expectedcss)*

*Defined in [src/assertCascade.ts:52](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/assertCascade.ts#L52)*

___

<a id="expectedelement"></a>

###  expectedElement

**●  expectedElement**:  *`string`* 

*Implementation of [CascadeInformation](../interfaces/resolve_cascade.cascadeinformation.md).[expectedElement](../interfaces/resolve_cascade.cascadeinformation.md#expectedelement)*

*Defined in [src/assertCascade.ts:50](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/assertCascade.ts#L50)*

___

<a id="expectedhtml"></a>

###  expectedHtml

**●  expectedHtml**:  *`string`* 

*Implementation of [CascadeInformation](../interfaces/resolve_cascade.cascadeinformation.md).[expectedHtml](../interfaces/resolve_cascade.cascadeinformation.md#expectedhtml)*

*Defined in [src/assertCascade.ts:48](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/assertCascade.ts#L48)*

___

<a id="expectedstyles"></a>

###  expectedStyles

**●  expectedStyles**:  *[ComputedStyle](../interfaces/resolve_cascade.computedstyle.md)⎮`undefined`* 

*Implementation of [CascadeInformation](../interfaces/resolve_cascade.cascadeinformation.md).[expectedStyles](../interfaces/resolve_cascade.cascadeinformation.md#expectedstyles)*

*Defined in [src/assertCascade.ts:56](https://github.com/linkedin/opticss/blob/d5d95b5/packages/resolve-cascade/src/assertCascade.ts#L56)*

___

<a id="generatedmessage"></a>

###  generatedMessage

**●  generatedMessage**:  *`boolean`* 

*Inherited from AssertionError.generatedMessage*

*Defined in /Users/ceppstei/Work/sailfish/opticss/node_modules/@types/node/index.d.ts:5562*

___

<a id="message"></a>

###  message

**●  message**:  *`string`* 

*Inherited from AssertionError.message*

*Defined in /Users/ceppstei/Work/sailfish/opticss/node_modules/@types/node/index.d.ts:5558*

___

<a id="name"></a>

###  name

**●  name**:  *`string`* 

*Inherited from AssertionError.name*

*Defined in /Users/ceppstei/Work/sailfish/opticss/node_modules/@types/node/index.d.ts:5557*

___

<a id="operator"></a>

###  operator

**●  operator**:  *`string`* 

*Inherited from AssertionError.operator*

*Defined in /Users/ceppstei/Work/sailfish/opticss/node_modules/@types/node/index.d.ts:5561*

___


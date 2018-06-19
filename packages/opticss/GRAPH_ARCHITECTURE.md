# General CSS Graph Optimization
**Adam Miller \<ammiller@linkedin.com\>**

## Overview
The interactions between CSS, the styling language of the internet, and HTML, including all its associated templating languages, presents a very complex problem space.

<Write a breif overview of the problem, and solution>

Below, I propose one possible solution for computing and generating optimized CSS style sheets for any given app structure.

## HTML and CSS: Two Sides of the Same Coin
Our largest breakthrough when evaluating solutions for a general case CSS optimizer came with the realization that both CSS selectors, and template languages actually encode the same exact type of information. Any stylesheet or template encodes three (3) types of data, with varying degrees of granularity and expression. For the purposes of this document, we call these three types of data **Key Selectors**, **Scopes** and styling **Conditions**

### Key Selectors
**Key Selectors** represent a single unit of style application. They bundle a group of style **Declarations** (called a **Ruleset**) to be applied to an **Element** under a certain **Condition**.

### Scopes
Scopes are the style **Conditions** of an **Element**'s parents that must be fulfilled, along with a truthy **Condition**, to apply a given **Key Selector**'s **Ruleset**.

This paper assumes an **Element**'s **Scope** to be un-knowable at build time. In current templating languages it is too difficult to resolve all possible options for DOM hierarchy for any given element. Therefore, we make the safest possible assumption and assume that for every element, every possible **Scope** discovered in the CSS may be fulfilled at some point in runtime. This is an obvious space for improvement in the near future through:

 1. extending this proposal to work with a hypothetical templating language with statically analyzable **Scope** data, and;
 2. development of a fully statically analyzable templating language.

However, although statically analyzing **Scope** may be *technically* feasible, it may prove to be impractical in practice. Consider: 

A component who's style changes depending on the context it is loaded (this is typically an anti-pattern, though appears not-infrequently through the use of privileged "friend" components that have some understanding of each others ' internals). Depending on the ordering of the "friend" components' nesting, the child components may choose to style their internals differently. This can be accomplished though **Scope** selectors.

```html
<!-- Un-nested use of component two -->
<comp-2 class="c2">I'm blue</comp-2>

<!-- Nested inside of component 1 -->
<comp-1 class="c1">
  <comp-2 class="c2">I'm red</comp-1>
</comp-1>
```

```css
  .c2     { color: blue; }
  .c1 .c2 { color: red;  }
```

Given the above information, we could *theoretically* analyze the application and reduce the complex `.c1 .c2` selector to a single class, statically applying it at the nested call site in the template.

However, if the class `c1` in component one is dynamic, we quickly run into a problem:

```hbs
<!-- Nested inside of component 1 -->
<comp-1 class={{if foo "c1"}}>
  <comp-2 class="c2">I'm red</comp-1>
</comp-1>
```

The application of our simplified selector to component two now relies on a piece of *private* internal state to component one. Any actual runtime will now need to pass private state of parent components down to children that depend on their scope's  state – a non-trivial and potentially performance impacting concern. We do have an opportunity to do this kind of optimization internally to components, where we can assume all data is available, but in a world with dynamic templates and partials this is still a difficult problem. So, for the sake of simplicity, we will take a naive approach to managing **Scope** and DOM hierarchy in an application.

### Conditions
**Conditions** are **Boolean Expressions** that, when truthy, and when a given **Scope** requirement is fulfilled, apply a given **Key Selector**'s **Ruleset** to the associated **Element**. Conditions often represent application state logic (ex: `isOpen` or `isLoggedIn`), but as we'll see, are also encoded by CSS stylesheets' complex **Key Selectors**.

## Defining the Application Condition Space
By analyzing both the stylesheet and template for these three concepts, **Key Selectors**, **Scope**, and **Conditions**, we are able to create a well-defined **Condition Space** that represents all possible states of an application. Then, by using this information, we can compute an optimal stylesheet while guaranteeing we don't break any possible state the application may find itself in.

To do this, we must be able to store the **Condition Space** encoded in an application's templates and stylesheets into a unified data model. Luckily, graphs are an excellent way to do this. With this, we introduce our first three (3) graph node types: **Elements Nodes**, **Condition Nodes**, and **Key Selector Nodes**

### HTML Condition Encoding

![HTML Condition Illustration](https://user-images.githubusercontent.com/7856443/41287001-a2db8080-6e41-11e8-8563-6cdf5b3fe3e1.jpeg)

**Element** nodes represent a single element in the DOM. **Elements** may match zero to many **Key Selector** under certain **Conditions**. Any **Element** may also define some kind of **Scope** state though the DOM hierarchy associated with the element, but as mentioned above, in this implementation we assume all possible scopes are possible.

**Key Selector** data are stored on **Elements** in one of three ways (more may be added at the discretion of the templating language):

 - Tag name (typically static state)
 - Attributes (ex: `state:foo={{condition}}`)
 - Classes (ex: `class="foo"` or `class={{style-if condition "foo" "bar"}}`

**Conditions** are also encoded by the templating language. Because **Conditions**, by our definition, are simple **Boolean Expressions**, we don't much care about the exact input of the expression – only the "shape" of it. As such, many templating language, regardless of the complexity of the input, will only encode existence (ex: if a value is truthy) and negation (ex: a false fallback in a ternary expression).

For example, the following element:

```html
<el class={{if cond1 "c1" "c2"}} state:st1={{cond2}} />
```

Results in the **Conditions**:

```
.c1  ≡ cond1
.c2  ≡ ¬cond1
[state:st1] ≡ cond2
el  ≡ true
```

And the graph:

![Markup Conditions Graph](https://user-images.githubusercontent.com/7856443/41287038-c83b7f10-6e41-11e8-9220-72980b4ea1ca.jpeg)

For elements with more complex conditions (ex: more expressive template languages, substate sugar, etc) it helps to store the source expression on the element node itself and instead simply reference the logical "shape", allowing us to easily reason about boolean logic, while leaving actual value calculation to the JS or template runtime. Ex:

```jsx
<el
  class={style (!foo & bar) "c1" "c2"}
  state:st1`={baz} // `st1 has 2 substates "bar" and 
                   // "baz", and a  presence selector
/>
```

The **Element** node may hold reference to the following expression map:

| ref | expr |
|:--|:--|
| **a** | `!foo & bar` |
| **b** | `baz` |
| **c** | `baz === "bar"` |
| **d** | `baz === "baz"` |

Resulting in the following **Conditions**:

| ref | expr |
|:--|:--|
| `.c1` | **a** |
| `.c2`  | **¬a** |
| `[state:st1]` | **b** |
| `[state:st1="bar"]` | **b ^ c ^ ¬d** |
| `[state:st1="baz"]` | **b ^ d ^ ¬c** |
| `el` | **true** |

And the following graph:

![Abstracted Markup Conditions Graph](https://user-images.githubusercontent.com/7856443/41287044-c9c52dae-6e41-11e8-953f-e411b4e55e22.jpeg)

As you can see, testing for truthyness, string equality comparisons, and other complex application logic can largely be abstracted from this graph implementation, allowing us to focus on the core boolean logic. Note that as we construct our condition space we are able to capture some styles' mutual exclusivity in the expression chart.

> Note: There is no method yet for dealing with attributes of an unknown value, or knowing the start / end string. This proposal will need to be augmented with that functionality.

### Stylesheet Condition Encoding
After parsing the templates and encoding their conditionals in this language-agnostic format, we have all the information required to process our stylesheets' conditional encodings.

Conditions inferred from styles can encode a little more complexity than their template counterparts, but not much. The grammar is well-defined and deterministic.

Any complex **Key Selector** present in the stylesheet encodes some kind of state **Condition** for its application. There are three (3) possible **Key Selector** operators in CSS that define any selector's **Condition** these are:

#### Same Element Combinator
Simple **Key Selectors** said to be on the same element map to the logical `and` operation. Ex:

 - `.foo.bar` ≡ `a ^ b`
 - `div.foo[attr]` ≡ `a ^ b ^ c`
		
#### `:not()` Selector
The `:not()` selector encodes the logical negation operation. Ex:

 - `.foo:not(.bar)` ≡ `a ^ ¬b`
 - `.foo:not(.bar, .baz)` ≡ `a ^ ¬(b ^ c)`

#### `:matches()` Selector and Multiple Selectors
The `:matches()` selector and multiple selectors encode the logical `or` operation. Ex:

 - `.foo, .bar` ≡ `a v b`
 - `.foo:matches(.bar, .baz)` ≡ `a ^ (b v c)`

We will call this expression discovered by the constituent parts of a complex selector its **Generic Condition**. This condition shape is not the final condition we will associate with matching element, because each element may choose to apply its constituent parts using additional logic. For example, the selector: `.foo.bar` has a **Generic Condition** shape of `a ^ b`. However, when applied to an element with the following condition definitions:

| ref | expr |
|:--|:--|
| `.foo` | **a** |
| `.bar`  | **¬a** |

The **Expanded Condition** for this **Complex Selector**, on this specific **Element** evaluates to: `a ^ ¬a`. This is because we substitute the constituent parts of our **Generic Condition** expression with the **Condition**s this element associates with each part.

### Complex Selector Matching
**Assertion:** A complex selector matches a given element iff:

  1. All possible **truthy** selectors are present and used (ex: `a ^ ¬b` must validate that `a` is possibly used on the element, but not `b`, because not existing **is** a valid state.
  2. At least **one** result of the truth table for the **Expanded Condition** expression that represent this complex selector's use on the element, is truthy. Aka: There exists *some* application state for the element where this complex selector will be applied. 

For example, given:

| ref | expr |
|:--|:--|
| `.foo` | **a** |
| `.bar`  | **b** |
| `.foo.bar`  | **a ^ b** |

The following truth table tells us that `.foo.bar` *is* a matching selector for this **Element** in some hypothetical application state:

| a | b | a ^ b |
|:--|:--|:--:|
| T | T | ✨ **T** ✨ |
| T | F |  F |
| F | T | F |
| F | F | F |

However, for mutually exclusive styles you'll see that complex selectors are not matched to the **Element** in *any* possible application state. Therefore, this complex selector should not be associated with this element:

**Expression:**

| ref | expr |
|:--|:--|
| `.foo` | **a** |
| `.bar`  | **¬a** |
| `.foo.bar`  | **a ^ ¬a** |

**Truth table:**

| a | ¬a | a ^ ¬a |
|:--|:--|:--:|
| T | F | F |
| T | F | F |
| F | T | F |
| F | T | F |

Therefore, we can define a process for testing if a **Complex Selector** should be associated with an element:

 1. Split the complex selector into its constituent simple selectors;
 2. For every element in the graph, test if all truthy simple selectors are possibly applied;
 3. Of this subset of **Elements** that possess all simple selectors, construct each unique **Expanded Condition**;
 4. Compute the truth table of this **Expanded Condition**. If even a single option is true, we should associate this condition and selector to the **Element** in our final graph.

**Complex Selectors** may be added to our **Condition Space** graph exactly like the the **Simple Selectors** and **Conditions** discovered from our templates:

![Stylesheet Conditions Graph](https://user-images.githubusercontent.com/7856443/41287046-cb4cbe8a-6e41-11e8-9996-05c13927c39a.jpeg)

> TODO: Talk more about pseudo selectors

Once all templates and stylesheets have been added to our **Condition Space** graph, we can consider all of our possible application states properly represented! In the next step we will augment this application state information with style definition and cascade data.

## Declaration Style Data
With our **Condition Space** well defined, we may now augment our graph with style data.

> Note: Here we discuss style tracking as an independent step in the process, but in a real-world implementation this step can likely be done at the same time as Condition Space construction, minimizing runtime complexity.

The information we need to capture in our graph is as follows:

 1. Each **Key Selector** node is associated with zero-to-many **Rulesets**;
 2. Each **Ruleset** has zero-to-many **Declarations**, where a **Declaration** is a unique CSS `<property>: <value>` pair;
 3. Each **Ruleset** operates within a certain **Scope**, where  its **Scope** is a CSS **Scope** selector – if no explicit **Scope** selector is present, the zero-specificity "root" scope is implied;
 4. Each **Ruleset** may specify one of three (3) style **Targets**, these are the `:before` and `:after` pseudo-elements, and the element itself.

Once this information is captured, we will use it to merge as many **Declarations** as possible, to reduce duplication in the stylesheet, without breaking the style cascade resolutions for any possible application state, represented by our **Condition Space**.

### Context is Important
As mentioned above, this solution does not attempt to statically analyze element hierarchy. This means we must take a more naive approach to handling **Scope**. I affectionately call the method proposed in this paper for naive handling of **Scope**: **Optimization Contexts**.

A **Context** is the unique combination of a selector's **Scope** and **Target**. With a little thought, we can prove that it is impossible to safely merge **Declarations** between different **Contexts**.

If we try to merge declarations across **Scopes**, we run into the data-sharing and DOM hierarchy analysis problem detailed above – the merge would require rewriting an **Element's** condition expressions in ways that we simply don't have the data to support.

We cannot merge declarations from **Rulesets** with different **Targets** because there is no way to specify a class' **Target** other than in the CSS selector – they physically cannot share a selector. (We *can* comma-delineate selectors with identical **Rulesets**, but we can do this as a post-optimization step.) 

Looking at a sample stylesheet, it becomes easy to pick out our different **Optimization Contexts**.

```css
.foo  { /* ... */ }
.bar { /* ... */ }
.bar .foo  { /* ... */ }
.baz .bar.foo { /* ... */ }
.baz .bar  { /* ... */ }
.baz .bar:before { /* ... */ }
.foo.biz .baz .foo.bar:after { /* ... */ }
```

Given the above stylesheet, we can discover the following unique contexts (combination of **Scope** and **Target**) and the **Key Selectors** within that scope:

| Scope | Target | Key Selectors |
|:--|:--|:--|
| `:root` (implied) | `:self` | `.foo, .bar` |
| `.bar` | `:self` | `.foo` |
| `.baz` | `:self` | `.bar.foo, .bar` |
| `.baz` | `:before` | `.bar` |
| `.foo.biz .baz` | `:after` | `.foo.bar` |

### Creating the Selector Space
Lucky for us, the above table represents almost exactly how we will store our context and key selector information in our graph! The **Context** node serves as the starting node for a linked list that then contains all the **Key Selectors** within that **Context** in specificity / cascade order. We also link all **Context** nodes in specificity / cascade order to track their relationship in the stylesheet.

> Note: Encoding Specificity and Cascade
> Specificity matters in CSS documents. In order to preserve this data as we transform our graph, we ensure that all **Context** and **Key Selector** nodes are sorted in order of both specificity and cascade. This structure will become important later as we undergo node consolidation.

This gives us a linked-list of linked-lists graph structure with the implied `:root` **Context** as its root. From here on out, we will call this linked-list of linked-lists structure our **Selector Space**.

![Selector Specificity Graph Example](https://user-images.githubusercontent.com/7856443/41287532-4a3a50bc-6e43-11e8-85d0-28d4e5b5b41d.jpeg)

### Adding Declarations
We now get to seed our **Selector Space** with the individual style **Declarations** in our stylesheet. In this context, the word **Declaration** refers to the unique combination of css `<property>: <value>;` pairs.

 1. In specificity / cascade order, for every **Ruleset** in our stylesheet(s), discover its **Key Selector**, under the right **Context**, within our **Selector Space**.
 2. For each **Declaration**, create a new, *unique* **Declaration** node and add it as a child of the **Key Selector**.
 3. If, a **Declaration** with the exact same `property` name has already been added as a child of this **Key Selector**, remove it from the graph – this is a duplicate **Declaration** and would be overridden by the new one, no need to keep it.

Special consideration must be provided for shorthand/longhand **Declarations** and progressive enhancement / graceful degradation. In these situations, order *within* the **Ruleset** matters. We denote the importance of this ordering by directionally linking *only* the declarations with an ordering-dependency into a directional linked list. As you will see shortly, this directed connection is important to preserve the cascade once we begin merging declarations. 

> For reasons explained shortly, implementors may find it helpful at this stage to uniquely "color" the edges of these linked list so members of the list can identify other members in O(1) time, without having to traverse the graph.

Alternatively, shorthand expressions may be automatically expanded to their longhand forms instead of annotating declaration order and opting to remove duplicate expressions. This has the added benefit of allowing for greater flexibility when merging declarations. However, the choice between the two options is best left to the implementor until further analysis can be done.

For example, given: 
```css
.foo { color: red; }
.foo.bar { color: blue; }
.foo .biz { color: green; }
.foo .biz.baz {
  color: yellow;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}
```
We can construct the following **Selector Space**:
![Declarations Example](https://user-images.githubusercontent.com/7856443/41287983-f8716584-6e44-11e8-82cf-ccfa07186252.jpeg)

> Note: In all images that contain complex **Key Selectors** we are using the in-source representation of the **Key Selector** for illustrative purposes. In reality, because we have captured their encoded boolean condition in our **Condition Space**, we are safe to give these nodes auto-generated unique names.

## All Together Now – The Application Graph
With our **Selector Space** and **Condition Space** both built out, we may connect the two by removing the **Key Selectors** in our **Condition Space** graph and instead connecting each **Condition** node to the zero-to-many matching **Key Selector** nodes in the **Selector Space** graph. We are now done creating new nodes and the resulting **Application Graph** fully represents the user-authored version of our source code.

![Full Application Graph Image Here][PLACEHOLDER]

## The Micro-Cascade
Not all cascade data stored in the stylesheet(s) are important. In fact, the majority of it is un-needed. Cascade information  between two given **Declarations** is only important to preserve if:

  1. Their two owning **Rulesets** may be applied to the same **Element** for *some* possible application state, and;
  2. the two declarations are *order-dependent*, meaning the relationship between the two **Declarations** is one of:
    1. they share the same `property` value, or;
    2. one is a shorthand/longhand of the other, or;
    3. they are vendor-prefixed variants (progressive enhancement / graceful degredation)

To encode this ordered dependency information into our style graph, we will connect dependent **Declarations** into their own linked lists.

We have already been introduced to the concept of micro-cascade preservation in the previous section when we linked related **Declarations** in the previous step. We must now do the same for *all* **Declaration** nodes that fulfill the above requirements.

We may do so through the following steps:

> Again, for reasons explained shortly, implementors may find it helpful at this step to uniquely "color" the edges of these linked list so members of the list can identify other members in O(1) time, without having to traverse the graph.

  1. Iterate through each **Element**;
  2. For every unique pair of **Conditions** on the element, compute the truth table for that pair;
  3. If at least one result of the table is truthy, this means that the **Key Selectors** *may* appear together on the same element in some possible application state;
  4. For each **Context** that the discovered **Key Selectors** are members of, discover the list and order of **Key Selector** nodes referenced by the **Condition** pair;
  5. In *specificity order*, add a directed edge between every order-dependent **Declarations** from the two **Key Selectors** – if there are multiple order-dependent declarations in the destination **Key Selector**, they should already be linked from the previous step, feel free to only link to the head of the existing chain, although this won't effect the end result.

Once this process has been carried out for every **Element**, our declaration nodes will be veined with **Cascade Trees**. As we will prove shortly, as long as the sanctity of these tree sub-graphs are preserved (read: they remain proper n-ary trees and no cycles are introduced), we can guarantee that any given CSS transformation is safe for our **Application Space**, and will not effect the output CSS' cascade.

![Micro Cascade Trees Graph][PLACEHOLDER]

## Declaration Merging
Now that our **Cascade Trees** are marking the order-dependent **Declarations**, we can begin the process of merging as many **Declarations** into their own **Key Selectors** as possible.

The process goes as followed:

  1. For each **Context**, start at the first **Key Selector** node. This is the **Active Selector**.
  2. For each child **Declaration** node of the **Current Selector**, note its `<prop>: <value>;` pair and begin walking the **Key Selector** list. We will call the **Key Selector** currently being tested the **Candidate Selector**.
  3. Iff you encounter a **Candidate Selector** that contains the same `<prop>: <vallue>;` pair, it is a valid candidate for merging.
  4. Test if merging these two declarations would cause a cycle in *any* **Cascade Tree** they are a part of (this is where those edge colorings come in handy – it becomes an O(1) presence test instead of a graph search problem).
  5. If the merge would cause a cycle, leave the **Declaration** alone and stop searching for matching **Declarations**. Move on to the next **Declaration** in the **Active Selector**.
  6. If the merge would *not* cause a cycle, we must merge the declarations. 
     1. Insert a new **Key Selector** into the selectors linked list before the current **Active Selector**;
     2. Add a single **Declaration** node under it with the same `<prop>: <value>;` pair;
     3. Re-wire all incoming and outgoing **Cascade Tree** edges of the two discovered **Declarations** to the new node; 
     4. Remove the two discovered **Declarations** from the graph.
     5. Connect the new **Key Selector** to all the same conditions connected to by the **Active Selector** and **Candidate Selector**.
   7. Continue the search until you:
      1. Find a **Cascade Tree** cycle, or;
      2. reach the end of the linked list.
   8. If you discover another matching **Declaration**, use the same generated **Key Selector** as in step 6. This time:
      1. Re-wire all incoming and outgoing **Cascade Tree** edges to the new **Declaration** node, and;
      2. Connect the generated **Key Selector** to the **Condition** nodes of the **Candidate Selector**.
      3. If there are no remaining **Declaration** nodes under the **Candidate Selector** or **Active Selector**, you may remove the **Key Selector** from the graph.

![Declaration Merging Graph][PLACEHOLDER]

> TODO: Write merging proof

## Pushing all Logic to the Template

> TODO: Write about *why* it is okay to *always* push logic into the templates and flatten complex css selectors, yes I have an explanation!

## New CSS Generation

> TODO: Write about how we convert this graph back into a CSS file.

[PLACEHOLDER]: http://hdimages.org/wp-content/uploads/2017/03/placeholder-image4.jpg

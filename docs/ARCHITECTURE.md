# Architecture

OptiCSS is a multi-pass CSS optimizer where each pass performs a different optimization.

## Template Analysis and Rewriting

Template analysis and rewriting is what makes the powerful optimizations in
OptiCSS possible. Analysis describes *all* possible runtime states of every element for those element attributes that are participating in optimization.

Because the specificity of inline styles is greater than that of all possible selectors in a stylesheet (sans the use of `!important`), inline styles can be applied safely to elements to override optimized styles when the runtime values of those declarations cannot be known or enumerated at build time.

### Analysis Guarantees and Requirements

1. **Complete**: Every element that use styles being optimized by OptiCSS must be analyzed before optimization and rewritten afterwards. Failure to analyze and rewrite every element will result in OptiCSS potentially breaking the styles for that element.
2. **Exclusive**: Conversely, if an element uses styles that aren't optimized as well as styles that were, no guarantee is made that the cascade will correctly resolve to the same values as before optimization. *Note: With new configuration options, analysis information, and/or access to unoptimized css, OptiCSS can be made to work in a non-exclusive mode.*
3. **Exhaustive**: All possible runtime states of an element for those attributes being optimized should be known. While element analysis supports the ability to specify unknown values, doing so can very easily nullify or greatly diminish the optimizations that OptiCSS performs.
4. **Conservative**: An analyzer should be *confidant* in its analysis. In languages like JavaScript with closures and global state, it can be quite easy to end up with a value being mutated in a way or based on a condition that is not well understood statically. Without strong feedback from the analyzer (e.g. errors), the user may inadvertently put an element into a state that the optimizer didn't expect resulting in a broken interface.

### What is Analyzed

Template analysis is an exercise in producing information from templates that is actionable, meaningful, and less complex than the template itself.

To that end, template analysis does not currently model hierarchical relationships between elements. Certainly, that information would enable some very interesting optimizations,such as selector flattening and more accurate dead-style pruning, but it has been our judgement that we could not produce a hierarchal analysis that we would trust to be correct for all possible runtime states. If there is ever a proposal for an analysis that produces even a partial analysis of hierarchical relationships that is sufficiently beneficial and accurate, we're open to revisiting this decision.

A template analysis, is a collection of individual elements that may appear in a template. Together with information about what source file it was in an where in that file the element was location. For each analyzed element, the possible values for the attributes most involved with styling have has proven to produce sufficient information to drive powerful *and accurate* optimizations.

For most applications and frameworks, analyzers should analyze at a minimum, the `class` attribute. Even if a framework doesn't use the class attribute, producing an analysis of the class attribute enables OptiCSS to output optimized attributes as classnames, which allows for the best runtime performance and smallest output.

### Element Analysis

An HTML element is a tag with attributes where those attributes may be
assigned a value. This is also the foundation of element analysis. The
analyzer tells OptiCSS which attributes it has analyzed. All other
attributes, if targeted by a selector, are treated as if their value is
`unknown`. For those attributes that are analyzed, the analyzer must specify when an attribute may have an unknown value, otherwise, the optimizer will assume the attribute is not present.

#### Specifying an Attribute's Value

An attribute's value can be a complex value when it must describe all runtime states of the element. An element's value can be described in one of the following ways:

* `constant` - The exact value of the attribute; it has no runtime substitution or interpolation.
* `absent` - The attribute has no value (but the attribute itself is still present).
* `unknown` - The attribute has an unknown value. The value may have whitespace, which to attributes with whitespace delimited values means that it may have one or more unknown identifiers. Lastly,or the value itself may be completely empty.
* `unknownIdentifier` - When a value is unknown, but it can be guaranteed to not contain any whitespace. For some optimizations, the distinction between one and several unknown values can make the optimization more effective.
* `startsWith` - When a value starts with some static component and ends with an unknown dynamic interpolation. This can be used to represent interpolated values with or without whitespace.
* `endsWith` - When a value starts with some dynamic interpolation and ends with a unknown dynamic interpolation. This can be used to represent interpolated values with or without whitespace.
* `startsAndEndsWith` - When a value has some unknown dynamic interpolation in the middle. This can be used to represent interpolated values with or without whitespace.
* `oneOf` - Represents a choice for an attribute's value between one of several possible values described by the other types in this list. The values are mutually exclusive at runtime.
* `allOf` - For whitespace delimited values, this describes the list of values that are separated by whitespace. Each value can be one of the other values in this list, with the exception of `unknown` which renders the enumeration pointless.

Example: A value that is "optional" (e.g. sometimes present) would be represented as a `oneOf` choice between a `constant` value and an `absent` value.

It should be noted that because `oneOf` and `allOf` can be nested without limit, a value's description can represent very complex descriptions of what values an attribute can have and whether those values are possibly coincident on the same element. This is what makes it possible for OptiCSS to decide whether two selectors have a cascade conflict on an element and avoid introducing a mutation that would resolve incorrectly in any state.

For this reason, it is the accuracy of an analyzer in describing the dynamic states of an element that allows OptiCSS to more aggressively optimize the styles that match that element. For instance, if an analyzer cannot prove that two classnames are mutually exclusive it should not represent those values that way, it would be better to represent those two values as a list (`allOf`) where each value is an optional value as described above.

#### Specifying an Element's Name

An element's tag name can be specified similarly to an an attribute value, but with a much more limited type of values:

* `constant` - The exact value of the element's name; it has no runtime substitution or interpolation.
* `unknown` - The name of the element is unknown.
* `oneOf` - Represents a choice for one of several `constant` values.


#### Pending Features of Element Analysis

* Element analysis needs a way to specify when an attribute is only sometimes present. ([Issue #16](https://github.com/css-blocks/opticss/issues/16))
* Element analysis needs a way to specify when one or more attributes have values that are correlated in some state or set of states. ([Issue #17](https://github.com/css-blocks/opticss/issues/17))

#### Selector Matching Against an Element Analysis

In a browser, when selectors are matched against an element it is always in a single state. In OptiCSS an analysis describes a complex interplay of different states and has the full document in scope, so the traditional definition of whether an element is matched by a selector does not apply. 

Because of unknown information and other complexities of matching, matching a simple selector against an attributes value can return four possible values:

* `yes` - The selector definitively matches.
* `maybe` - Interpreted as a `yes` in most situations, but the presence of ambiguity can inform logging, debugging, and other nuanced analysis.
* `no` - The selector does not match the element.
* `pass` - The selector cannot be matched meaningfully against the value being considered. Examples: a tag selector or the `:hover` pseudo class being matched against a value for the `class` attribute; the decision for that simple selector will need to be decided by a different context.

In OptiCSS, there are three different types of matching that can be performed against an element:

1. Compound Selector Match - If any compound selector in a complex selector might match the element in at least one possible state of its attributes and values.
2. Key Selector Match - Like the compound selector match, but where only the compound selector that is the key selector is considered.
3. Multiple Key Selectors Match - Several key selector are considered simultaneously and a match happens if they all match for at least one possible state of its attributes and values.

While matching is always done in the context of a specific element's analysis, it's possible to query for all elements that match specific selectors by using an appropriate subclass of the `Query` class.

## Style Mapping

The style mapping class holds information about mutations performed on the stylesheet so that it can produce a mapping from an analyzed element's original attributes and values to the optimized versions for that element.

### Tracking Changes

As the optimizer works, it mutates stylesheet selectors in a number of different ways and informs the style mapping about changes that can affect the rewrite of elements. Changes that are tracked include:

1. **Mark attribute as obsolete** - Marks an attribute with a specific value as no longer being needed by the stylesheet to match against any selector. The mapping will will instruct the rewriter to remove that attribute/value pair from elements that have it.
2. **Rewrite Attribute** - Changes a specific attribute/value pair to a new attribute/value pair. the target attribute can be different from the source attribute. When the target attribute is a whitespace delimited attribute, this instruction is understood to be adding a new value to the attributes list of value. The semantics for how this would be interpreted for other attribute types is currently undefined (and at the time of this writing would likely behave like it's a whitespace delimited attribute). The source attribute/value pair is considered obsolete and removed when encountered.
3. **Link Attributes** - links a new attribute/value pair to the conditional presence of one or more source pairs. At least one of the source pairs must be a positive signal to link the new pair when it is found. Other pairs' presence can cause the link to be aborted.

### Rewrite Mapping

After optimization, the style mapping can derive new values for any attribute that is configured to be rewritten from an element's analysis information.

The rewriter must, for every analyzed element, query the style mapping for a rewrite of all rewritten attributes, even if that attribute was not originally present on the element. The original values for the any existing rewritten attributes should be discarded and the values should become the new value as directed by the element's computed RewriteMapping.

The rewrite mapping has references to input tag names and attribute/value pairs, static values for the rewritten attributes, and dynamic values for the rewritten attributes. Dynamic values are specified as a boolean expression over the presence of input attributes that the analysis indicates has some dynamic behavior. The rewriter must create an appropriate template-specific implementation to produce the dynamic values from the conditionals that created the original inputs and then further evaluated against the boolean expression over those inputs.

The boolean expression for a dynamic output is what gives OptiCSS the ability to avoid cascade issues with the selectors it creates -- it can intelligently remove attribute values that would match selectors that would override the desired declaration(s).

It should be clear at this point that OptiCSS is moving some complexity of cascade resolution from CSS to the template language. If this is not done carefully, the savings associated with optimizing can be lost to inefficient template code.

For an example of what an efficient dynamic rewriter looks like, you can refer to the [runtime component of css-blocks](https://github.com/css-blocks/css-blocks/tree/master/packages/runtime). The README for that package explains the extremely terse encoding for dynamic rewrites that it uses.

## Optimizations

### Identifier Rewriting

Identifiers make up a large number of the bytes in our code. In Javascript, tools like uglify and closure compiler, have replaced our developer friendly identifiers with terser values that are a smaller number of bytes but also, by using a compact space for identifiers, allows compression algorithms to more effectively reduce the space required to store a sparse identifier space even when the byte sizes of those identifiers are the same.

OptiCSS is able to bring this savings to applications, even client-rendered apps because it allows build-time rewriters to remove all instances of the original identifier from both the stylesheets and the templates that refer to them. No mapping from the original identifiers is needed once the rewrite is performed, even for dynamic conditions.

Of all the optimizations that OptiCSS performs, this one has the single greatest impact on file sizes.

Pending capabilities of the identifer rewriting optimization:

* Specifying a starting point for ident generation ([Issue #18](https://github.com/css-blocks/opticss/issues/18)).

### Removing Unused Styles

TODO: how to handle styles referenced in a component/template but never invoked within an application.

### Extracting Inline Styles

This feature is not yet implemented.

### Declaration Merging

* In order to optimize an analyzed attribute, the class attribute must be rewritable. 


## Mutating the Stylesheet

TODO

## Testing Strategies

TODO

## Project Layout

TODO

## Adopting an OptiCSS-backed Styling Framework

TODO

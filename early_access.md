CSS Block/OptiCSS Contributor Early Access Information
======================================================

CSS Blocks and OptiCSS are CSS technologies that have been developed by LinkedIn over the last 9 months are now mature enough that we're seeking
open source collaborators in advance of it being released for general
consumption.

### Goals of the Early Access Program

We're seeking collaborators who are excited about the possibilities
that these new technologies present and want to help invest in them.
The best contributions come from people who are actively using the
technologies and seeing what works and what doesn't or from people
who are experts at specific technologies that we use or integrate
with and can provide feedback, guidance, and code about how to better
interact with those.

The other main goal for the early access program is to get feedback
from others with different business requirements and use cases. If
big changes are needed, those are easier to make early on before we
have a 1.0 release and stability/migration requirements.

### Alignment of Goals

These technologies are designed with runtime performance as the first-order
requirement. This include but is not limited to:

* Getting small, compressed css files to the browser as quickly as
  possible so as not to delay rendering.
* Enabling cutting edge browser techniques for performance (code splitting,
  inlining critical css, h2 push, service workers, etc)
* Encouraging selectors that keep selector matching costs to a minimum.
* Avoiding changes that force the browser to reflow or recalculate the cascade.

Because performance is the primary goal of these technologies, where required
we will make necessary trade-offs to achieve those goals. This may result in:

* slower builds
* increased debugging time
* decreased developer flexibility

That said, we aim to provide a great developer experience, but it should be
understood that the developer experience will never be given precedence
over performance.

CSS Blocks is an opinionated framework. If you choose to adopt CSS Blocks,
you need to understand that it is opinionated. Those opinions are mine, and
you may not like them. I'm of the opinion that my opinions are very good, you
may not share that opinion, and that's fine; but you may not want to use
technology that enforces my opinions. I'm also of the opinion that my
opinions are open to being challenged and that there's experiences that I may
not have had and data I may not have seen that can cause my current opinion
to change. I don't intend to remain benevolent dictator for life, eventually,
I'd like to adopt an RFC process. But in the interest of moving fast and staying
nimble before 1.0, we'll wait to institute such process overhead.

CSS Blocks is built for large teams of developers who are of average CSS skill.
CSS Blocks, together with OptiCSS, makes it very hard for developers to
produce stylesheets that are bloated. CSS Blocks also makes it hard for developers
to be exceedingly clever -- especially when it comes to CSS selectors.

Adopting CSS Blocks is not an easy thing to do. It will challenge how you
think about CSS. It will present constraints that force you to take new
approaches to component design than you have taken in the past.

### What makes for an ideal early access partner?

* Able to absorb technical risk - APIs may change drastically. Stylesheet and
  template syntax may change. Schedules may slip. If your project can't absorb
  these risks, it's not a good match at this time.
* Please be able to assign dedicated, consistent people to working on this
  project for a minimum of 6 months. Beyond project integration, they should
  be given the time and space for investing in the project to solve the issues
  they encounter so that others will not face those issues.
* Good at figuring out complex builds, code and trail blazing new capabilities and
  applications.
* You currently use or have used BEM or a CSS methodology that is roughly
  equivalent (simple class names with a prefix for scoping and avoiding
  selector combinators where possible).
* You have a design system that distributes stylesheets with re-usable components
  to several applications (or you want to build such a thing).
* Ideal contributors will be working on building a new application or framework.
  Adopting CSS-Blocks into an existing application, is a huge undertaking and
  is likely to create inflexible constraints that we may not be able to agree on.

### What types of contributions are being sought?

Necessity is the mother of invention. By trying to use these tools, you will
probably see quickly what things are needed the most for your use cases. But
the things that we know we need right now are along these lines:

* Add new capabilities and features to CSS Blocks & OptiCSS.
* Tech-stack integrations for various build tools and application frameworks
  that aren't currently supported -- may require coordinating patches into
  upstream projects.
* Unit and integration test helpers and harnesses.
* IDE integration. CSS Blocks especially presents the opportunity for deep IDE
  integration with code completion, navigation to definition, etc.
* Debug Tools for CSS Blocks and OptiCSS. For instance, one can imagine
  a tool to trace one or more css classes through the optimization process.
  Or to be able use a slider to go forward and back through time and see how
  the optimizer had changed the stylesheet at any point in time.
* Reporting and analyis tools. For instance, a `css-grep` tool could be created
  that returns where a style is used or referenced in any stylesheet or template.
  That tool or a similar one could also analyze and report on styles that are
  used on the same elements. Maybe these could be interactive web apps or IDE
  plugins.
* Stylesheet documentation tools for generating documentation from existing
  stylesheets.
* Spec and champion an enhancement to the sourcemap specification that
  takes into account the merging of several source bytes into a single output
  byte.
* Demo Applications and technology previews
* On-boarding documentation.
* Documentation, tutorials, video content.

### What does a early access participant get?

You get to be in on the ground floor of working on technologies that people who have
seen it have called "ground-breaking", "the future", "industry changing". Your
voice and critical feedback will help shape it and make it better. You'll be
an expert on this technology before it's even on most people's radar.

You'll get a faster website. LinkedIn is poised to reduce css size by as much
as 95% *after* compression and by being able to leverage code-splitting and
tree-shaking reliably. Total application size is reduced by 5-10%.

Daily office hours with either Chris Eppstein or Adam Miller. We're committed
to having a daily, standing office hours set aside to help you discuss ideas,
get debugging help, etc. Because we're very busy, we cannot commit to supporting
you outside of those office hours, but we will do so if and when can.

Also: I will have laptop stickers and t-shirts. Everyone wants stickers and
t-shirts.

### Are we sure this technology works?

Yes. We have it working end-to-end in a technology prototype application that
reproduces a complex, real-world user interface. We would not ask you to
make a significant investment if we weren't confident this technology is
viable.

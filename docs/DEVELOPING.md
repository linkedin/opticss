Developing Software That Uses OptiCSS
=====================================

OptiCSS is written in TypeScript and we expect that the code that integrates with it non-trivially will also be written in TypeScript. Except in rare cases, the runtime code does not check for invalid arguments or bad data -- that's what the type checker is for.

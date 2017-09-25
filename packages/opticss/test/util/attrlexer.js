const moo = require('moo')

const lexer = moo.compile({
  WS:      /[ \t]+/,
  pipe: '|',
  lparen:  '(',
  rparen:  ')',
  asterisk: '*',
  unknown: '???',
  unknownIdentifier: '?',
  absent: '---',
  constant: /[^|()*\n \t]+/,
});

module.exports = lexer;
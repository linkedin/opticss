// Generated automatically by nearley
// http://github.com/Hardmath123/nearley
(function () {
function id(x) {return x[0]; }

const lexer = require("./attrlexer");
var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "main", "symbols": ["_", "attribute", "_"], "postprocess": (data) =>  data[1]},
    {"name": "attribute", "symbols": ["set"], "postprocess": id},
    {"name": "attribute", "symbols": ["choice"], "postprocess": id},
    {"name": "attribute", "symbols": ["constant"], "postprocess": id},
    {"name": "attribute", "symbols": ["unknown"], "postprocess": id},
    {"name": "attribute", "symbols": ["unknownIdentifier"], "postprocess": id},
    {"name": "attribute", "symbols": ["startsWith"], "postprocess": id},
    {"name": "attribute", "symbols": ["endsWith"], "postprocess": id},
    {"name": "attribute", "symbols": ["empty"], "postprocess": id},
    {"name": "set$ebnf$1$subexpression$1", "symbols": [(lexer.has("WS") ? {type: "WS"} : WS), "setItem"]},
    {"name": "set$ebnf$1", "symbols": ["set$ebnf$1$subexpression$1"]},
    {"name": "set$ebnf$1$subexpression$2", "symbols": [(lexer.has("WS") ? {type: "WS"} : WS), "setItem"]},
    {"name": "set$ebnf$1", "symbols": ["set$ebnf$1", "set$ebnf$1$subexpression$2"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "set", "symbols": ["setItem", "set$ebnf$1"], "postprocess": 
        (data) => {
          let rv = [data[0]];
          let rest = data[1];
          rest.forEach(r => {
            rv.push(r[1]);
          })
          return {allOf: rv};
        }
        },
    {"name": "setItem", "symbols": ["choice"], "postprocess": id},
    {"name": "setItem", "symbols": ["unknown"], "postprocess": id},
    {"name": "setItem", "symbols": ["unknownIdentifier"], "postprocess": id},
    {"name": "setItem", "symbols": ["constant"], "postprocess": id},
    {"name": "setItem", "symbols": ["startsWith"], "postprocess": id},
    {"name": "setItem", "symbols": ["endsWith"], "postprocess": id},
    {"name": "choice$ebnf$1$subexpression$1", "symbols": [(lexer.has("pipe") ? {type: "pipe"} : pipe), "_", "choiceOption", "_"]},
    {"name": "choice$ebnf$1", "symbols": ["choice$ebnf$1$subexpression$1"]},
    {"name": "choice$ebnf$1$subexpression$2", "symbols": [(lexer.has("pipe") ? {type: "pipe"} : pipe), "_", "choiceOption", "_"]},
    {"name": "choice$ebnf$1", "symbols": ["choice$ebnf$1", "choice$ebnf$1$subexpression$2"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "choice", "symbols": [(lexer.has("lparen") ? {type: "lparen"} : lparen), "_", "choiceOption", "_", "choice$ebnf$1", (lexer.has("rparen") ? {type: "rparen"} : rparen)], "postprocess": 
        (data) => {
          let rv = [data[2]];
          data[4].forEach(group => {
            rv.push(group[2])
          });
          return {oneOf: rv};
        }
        },
    {"name": "choiceOption", "symbols": ["set"], "postprocess": id},
    {"name": "choiceOption", "symbols": ["absent"], "postprocess": id},
    {"name": "choiceOption", "symbols": ["constant"], "postprocess": id},
    {"name": "choiceOption", "symbols": ["startsWith"], "postprocess": id},
    {"name": "choiceOption", "symbols": ["endsWith"], "postprocess": id},
    {"name": "absent", "symbols": [(lexer.has("absent") ? {type: "absent"} : absent)], "postprocess": (data) => { return {absent: true}; }},
    {"name": "empty", "symbols": [], "postprocess": (data) => { return {absent: true}; }},
    {"name": "unknown", "symbols": [(lexer.has("unknown") ? {type: "unknown"} : unknown)], "postprocess": (data) => { return {unknown: true}; }},
    {"name": "unknownIdentifier", "symbols": [(lexer.has("unknownIdentifier") ? {type: "unknownIdentifier"} : unknownIdentifier)], "postprocess": (data) => { return {unknownIdentifier: true}; }},
    {"name": "constant", "symbols": [(lexer.has("constant") ? {type: "constant"} : constant)], "postprocess": (data) => { return {constant: data[0].toString()}; }},
    {"name": "startsWith$ebnf$1", "symbols": [(lexer.has("constant") ? {type: "constant"} : constant)], "postprocess": id},
    {"name": "startsWith$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "startsWith", "symbols": [(lexer.has("constant") ? {type: "constant"} : constant), (lexer.has("asterisk") ? {type: "asterisk"} : asterisk), "startsWith$ebnf$1"], "postprocess": 
        (data) => {
          let v = { startsWith: data[0].toString() };
          if (data[2]) {
            v.endsWith = data[2].toString();
          }
          return v;
        }
        },
    {"name": "_$ebnf$1", "symbols": [(lexer.has("WS") ? {type: "WS"} : WS)], "postprocess": id},
    {"name": "_$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "_", "symbols": ["_$ebnf$1"], "postprocess": (data) => null},
    {"name": "endsWith", "symbols": [(lexer.has("asterisk") ? {type: "asterisk"} : asterisk), (lexer.has("constant") ? {type: "constant"} : constant)], "postprocess": (data) => { return {endsWith: data[1].toString()}; }}
]
  , ParserStart: "main"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();

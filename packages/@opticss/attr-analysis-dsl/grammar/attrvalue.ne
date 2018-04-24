@{%
const lexer = require("./attrlexer");
%}

@lexer lexer

@{%
  function choice(data) {
    let rv = [data[2]];
    data[4].forEach(group => {
      rv.push(group[2])
    });
    return {oneOf: rv};
  }
%}

whitespaceDelimitedAttribute -> set {% id %}
           | whitespaceDelimitedChoice {% id %}
           | constantWithoutWhitespace {% id %}
           | unknown {% id %}
           | unknownIdentifier {% id %}
           | startsWith {% id %}
           | endsWith {% id %}
           | empty {% id %}

attribute -> choice {% id %}
           | constantWithWhitespace {% id %}
           | unknown {% id %}
           | unknownIdentifier {% id %}
           | startsWith {% id %}
           | endsWith {% id %}
           | empty {% id %}

set -> setItem (%WS setItem):+ {%
  (data) => {
    let rv = [data[0]];
    let rest = data[1];
    rest.forEach(r => {
      rv.push(r[1]);
    })
    return {allOf: rv};
  }
%}

setItem -> whitespaceDelimitedChoice {% id %}
         | unknown {% id %}
         | unknownIdentifier {% id %}
         | constantWithoutWhitespace {% id %}
         | startsWith {% id %}
         | endsWith {% id %}

choiceOption -> absent {% id %}
              | constantWithWhitespace {% id %}
              | startsWith {% id %}
              | endsWith {% id %}

whitespaceDelimitedChoiceOption -> set {% id %}
              | absent {% id %}
              | constantWithoutWhitespace {% id %}
              | startsWith {% id %}
              | endsWith {% id %}

absent -> %absent {% (data) => { return {absent: true}; } %}

empty -> null {% (data) => { return {absent: true}; } %}

unknown -> %unknown {% (data) => { return {unknown: true}; } %}

unknownIdentifier -> %unknownIdentifier {% (data) => { return {unknownIdentifier: true}; } %}

whitespaceDelimitedChoice -> %lparen _ whitespaceDelimitedChoiceOption _ (%pipe _ whitespaceDelimitedChoiceOption _):+ %rparen {% (data) => choice(data) %}

choice -> %lparen _ choiceOption _ (%pipe _ choiceOption _):+ %rparen {% (data) => choice(data) %}

constantWithoutWhitespace -> %constant {% (data) => {
  return {constant: data[0].toString()}; }
%}

constantWithWhitespace -> %constant (%WS %constant):* {%
  (data) => {
    let rv = data[0].toString();
    let rest = data[1];
    rest.forEach(r => {
      rv += r[0].toString() + r[1].toString();
    })
    return {constant: rv};
  }
%}

startsWith -> %constant %asterisk %constant:? {%
  (data) => {
    let v = { startsWith: data[0].toString() };
    if (data[2]) {
      v.endsWith = data[2].toString();
    }
    return v;
  }
%}

_ -> %WS:? {% (data) => null %}

endsWith -> %asterisk %constant {% (data) => { return {endsWith: data[1].toString()}; } %}
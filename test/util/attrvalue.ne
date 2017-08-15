@{%
const lexer = require("./attrlexer");
%}

@lexer lexer

main -> _ attribute _ {% (data) =>  data[1] %}

attribute -> set {% id %}
           | choice {% id %}
           | constant {% id %}
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

setItem -> choice {% id %}
         | unknown {% id %}
         | unknownIdentifier {% id %}
         | constant {% id %}
         | startsWith {% id %}
         | endsWith {% id %}

choice -> %lparen
          _ choiceOption _
          (%pipe _ choiceOption _):+
          %rparen {%
  (data) => {
    let rv = [data[2]];
    data[4].forEach(group => {
      rv.push(group[2])
    });
    return {oneOf: rv};
  }
%}

choiceOption -> set {% id %}
              | absent {% id %}
              | constant {% id %}
              | startsWith {% id %}
              | endsWith {% id %}

absent -> %absent {% (data) => { return {absent: true}; } %}
empty -> null {% (data) => { return {absent: true}; } %}

unknown -> %unknown {% (data) => { return {unknown: true}; } %}

unknownIdentifier -> %unknownIdentifier {% (data) => { return {unknownIdentifier: true}; } %}

constant -> %constant {% (data) => { return {constant: data[0].toString()}; } %}              

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
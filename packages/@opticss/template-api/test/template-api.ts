import { assert } from "chai";
import { suite, test } from "mocha-typescript";

import { BooleanExpression, and, not, or } from "@opticss/template-api";

@suite("Template API")
export class TemplateAPITest {
  @test "Boolean expressions"() {
    let boolExpr: BooleanExpression<number> = and<number>(1, or(2, 3), not(4));
    assert.deepEqual(boolExpr, {
      and: [
        1,
        {or: [2, 3]},
        {not: 4},
      ],
    });
  }
}

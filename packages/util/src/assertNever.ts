import { inspect } from "util";

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${inspect(value)}`);
}

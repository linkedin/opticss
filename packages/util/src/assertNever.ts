import { inspect } from "util";

export default function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${inspect(value)}`);
}
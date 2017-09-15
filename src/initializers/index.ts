import { Initializer } from "./Initializer";
import initKnownIdents from "./initKnownIdents";

export {
  Initializer
} from "./Initializer";

export interface Initializers {
  initKnownIdents: Initializer;
}

const initializers: Initializers = {
  initKnownIdents,
};

export default initializers;
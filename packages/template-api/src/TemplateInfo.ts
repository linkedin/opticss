export interface TemplateTypes {
  "Opticss.Template": Template;
}

/**
 * This type is used to serialize arbitrary template info instances to JSON and back.
 */
export interface SerializedTemplateInfo<K extends keyof TemplateTypes> {
  /** This is the type string for the template info class as it's registered with TemplateInfoFactory. */
  type: K;

  /**
   * any identifier that can be used to look up a template by the templateinfo.
   * Usually a relative path to a file.
   */
  identifier: string;

  /** the values stored in here must be JSON-friendly. */
  data?: any[];
}

export interface TemplateInfo<K extends keyof TemplateTypes> {
  /**
   * The string under which the template is registered with the TemplateFactory.
   *
   * @type {K}
   * @memberOf TemplateInfo
   */
  type: K;

  /**
   * Any identifier that can be used to look up a template by the TemplateInfo.
   * Usually a path to a file.
   */
  identifier: string;
  serialize(): SerializedTemplateInfo<K>;
}

export type TemplateConstructors<T extends TemplateTypes = TemplateTypes> = {
    [P in keyof T]?: (identifier: string, ..._data: any[]) => T[P];
};

/**
 * Subclasses of TemplateInfo must be registered onto the static class factory.
 * it is important for the registered name of the template info to be unique
 * from all other possible names for other types of template info.
 *
 * A function that accepts serialized data and returns an instance of the type
 * must be registered so that serializable data types that have references to
 * templates can transparently serialize and deserialize them.
 *
 * Note that when using TypeScript, the TemplateTypes interface must first have your key and template type added to it
 * before attempting to register the deserializer function.
 *
 * import { TemplateTypes, TemplateInfo, SerializedTemplateInfo, TemplateInfoFactory } from "@css-blocks/opticss"
 * declare module "@css-blocks/opticss" {
 *   export interface TemplateTypes {
 *     "MyTemplateTypeName": MyTemplateClass;
 *   }
 * }
 *
 * class MyTemplateClass implements TemplateInfo<"MyTemplateTypeName"> {
 *   static deserialize(identifier: string, ...data: any[]): MyTemplateClass {
 *     return new MyTemplateClass(identifier);
 *   }
 *   serialize(): SerializedTemplateInfo<"MyTemplateTypeName"> {
 *     return { ... };
 *   }
 * }
 * TemplateInfoFactory.constructors["MyTemplateTypeName"] = MyTemplateClass.deserialize;
 */
export class TemplateInfoFactory {
  static constructors: TemplateConstructors = {};

  static create<K extends keyof TemplateTypes>(name: K, identifier: string, ...data: any[]): TemplateTypes[K] {
    // TODO: get rid of this stupid any
    let constructor: any = TemplateInfoFactory.constructors[name];
    if (constructor !== undefined) {
      return constructor(identifier, ...data);
    } else {
      throw new Error(`No template info registered for ${name}`);
    }
  }
  static deserialize<K extends keyof TemplateTypes>(obj: SerializedTemplateInfo<K>): TemplateTypes[K] {
    let data: any[] = obj.data || [];
    return TemplateInfoFactory.create(obj.type, obj.identifier, ...data);
  }
}

/**
 * Base class for template information for an analyzed template.
 */
export class Template implements TemplateInfo<"Opticss.Template"> {
  type: "Opticss.Template";
  identifier: string;

  constructor(identifier: string) {
    this.identifier = identifier;
    this.type = "Opticss.Template";
  }

  static deserialize(identifier: string, ..._data: any[]): Template {
    return new Template(identifier);
  }

  // Subclasses should override this and set type to the string value that their class is registered as.
  // any additional data for serialization
  serialize(): SerializedTemplateInfo<"Opticss.Template"> {
    return {
      type: this.type,
      identifier: this.identifier,
    };
  }
}

TemplateInfoFactory.constructors["Opticss.Template"] = Template.deserialize;
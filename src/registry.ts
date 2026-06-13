export type RegEntry<T> = T & { ID: number };
export type RegMap<T> = Record<string, Map<unknown, RegEntry<T>[]>>;
export type RegistryData<T extends object> = {
  elements: number;
  entries: RegMap<T>;
  IDs: RegEntry<T>[];
};

type IsPlainObject<T> = T extends object
  ? T extends any[] | Function | Date | Map<any, any> | Set<any>
    ? false
    : true
  : false;

type Paths<T> = T extends object
  ? {
      [K in keyof T & string]:
        | K
        | (IsPlainObject<T[K]> extends true ? `${K}.${Paths<T[K]>}` : never);
    }[keyof T & string]
  : never;

type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

function indexObject<T extends object>(
  registry: RegistryData<T>,
  entry: RegEntry<T>,
  obj: Record<string, unknown>,
  prefix = "",
) {
  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    let map = registry.entries[path];
    if (!map) {
      map = new Map();
      registry.entries[path] = map;
    }

    if (!map.has(value)) map.set(value, []);
    map.get(value)!.push(entry);

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      indexObject(registry, entry, value as Record<string, unknown>, path);
    }
  }
}

/**
 * A multi-index registry that automatically creates lookup indices for every
 * property of registered objects. Provides O(1) lookups on any field.
 *
 * @template T - The base type of objects to register. Must be an object type.
 *                An `ID` field is automatically added to each entry.
 *
 * @example
 * ```typescript
 * type Block = { name: string; hardness: number };
 * const registry = new Registry<Block>();
 *
 * registry.register({ name: "stone", hardness: 1.5 });
 * registry.register({ name: "dirt", hardness: 0.5 });
 *
 * // Look up by any property
 * const stone = registry.get("name", "stone"); // Returns block with name "stone"
 * const hard = registry.getAll("hardness", 1.5); // Returns all blocks with hardness 1.5
 * ```
 */
export class Registry {
  static create<T extends object>(): RegistryData<T> {
    return { elements: 0, entries: {} as RegMap<T>, IDs: [] };
  }

  /**
   * Registers a new object in the registry, automatically indexing it by all
   * its properties for efficient lookup. A unique numeric ID is assigned.
   *
   * The registered entry is stored in multiple indices simultaneously:
   * - The `ID` index maps the assigned ID to the entry
   * - Each other property maps its value to an array of entries with that value
   *
   * This means the same entry object is referenced from multiple indices,
   * keeping memory overhead low while enabling O(1) lookups on any field.
   *
   * @param object - The object to register. Must conform to type T.
   * @returns The registered entry with its assigned ID. The same object
   *          reference is stored in the indices, so mutations to the returned
   *          entry will be reflected in all lookups.
   */
  static add<T extends object>(registry: RegistryData<T>, objects: T[]) {
    for (const obj of objects) {
      const entry: RegEntry<T> = { ID: registry.elements++, ...obj };
      indexObject(registry, entry, entry as unknown as Record<string, unknown>);
      registry.IDs.push(entry);
    }
  }

  /**
   * Retrieves all entries matching a given property value. Returns an empty
   * array if no matches exist or if the property has never been indexed.
   *
   * This is an O(1) operation - it directly accesses the pre-built index.
   *
   * @param query - The property name to search by. Must be a key of the
   *                registered type (including the auto-generated "ID").
   * @param value - The value to match against. Type-safe: must match the
   *                type of the queried property.
   * @returns An array of all entries with the given property value.
   *          Returns an empty array `[]` if no matches found.
   */
  static getAll<T extends object, P extends Paths<RegEntry<T>>>(
    registry: RegistryData<T>,
    query: P,
    value?: PathValue<RegEntry<T>, P & string>,
  ): Readonly<RegEntry<T>>[] {
    if (value == undefined) {
      return Array.from(registry.entries[query as string].values()).flatMap(
        (n) => n,
      );
    }
    return registry.entries[query as string].get(value) || [];
  }

  /**
   * Retrieves the first entry matching a given property value, or `undefined`
   * if no match exists. This is a convenience wrapper around {@link getAll}
   * for the common case where you expect at most one match.
   *
   * Ideal for unique properties like "ID" or when you know only one entry
   * will match. For non-unique properties, use {@link getAll} instead to
   * see all matches.
   *
   * @param query - The property name to search by. Must be a key of the
   *                registered type (including the auto-generated "ID").
   * @param value - The value to match against. Type-safe: must match the
   *                type of the queried property.
   * @returns The first matching entry, or `undefined` if no match exists.
   */
  static get<T extends object, P extends Paths<RegEntry<T>>>(
    registry: RegistryData<T>,
    query: P,
    value: PathValue<RegEntry<T>, P & string>,
  ): Readonly<RegEntry<T>> {
    if (query === "ID") return registry.IDs[value as number];

    const entries = Registry.getAll(registry, query, value);
    if (entries.length === 0)
      throw new Error(`No entry with ${String(query)} = ${value} found`);
    return entries[0];
  }
}

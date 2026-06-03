export type RegEntry<T> = T & { ID: number };
export type RegMap<T> = {
  [K in keyof RegEntry<T>]: Map<RegEntry<T>[K], RegEntry<T>[]>;
};
export type RegistryData<T extends object> = {
  elements: number;
  entries: RegMap<T>;
};

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
    return { elements: 0, entries: {} as RegMap<T> };
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
  static add<T extends object>(
    registry: RegistryData<T>,
    object: T,
  ): RegEntry<T> {
    const entry: RegEntry<T> = { ID: registry.elements++, ...object };
    const properties = Object.keys(entry) as (keyof T)[];

    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      let map = registry.entries[property];

      if (!map) {
        map = new Map();
        registry.entries[property] = map;
      }

      const value = entry[property];
      if (!map.has(value)) map.set(value, []);
      map.get(value)!.push(entry);
    }

    return entry;
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
  static getAll<T extends object, K extends keyof RegEntry<T>>(
    registry: RegistryData<T>,
    query: K,
    value?: RegEntry<T>[K],
  ): Readonly<RegEntry<T>>[] {
    if (!value) {
      return Array.from(registry.entries[query].values()).flatMap((n) => n);
    }
    return registry.entries[query].get(value) || [];
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
  static get<T extends object, K extends keyof RegEntry<T>>(
    registry: RegistryData<T>,
    query: K,
    value: RegEntry<T>[K],
  ): Readonly<RegEntry<T>> {
    const entries = Registry.getAll(registry, query, value);
    if (entries.length === 0)
      throw new Error(`No entry with ${String(query)} = ${value} found`);
    return entries[0];
  }
}

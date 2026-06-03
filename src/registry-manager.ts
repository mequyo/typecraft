import { BlockStateData } from "./blockstate";
import { Registry, RegistryData } from "./registry";
import { TextureData } from "./texture";
import { BlockData, ItemData, RecipeData } from "./types";

type RegistryEntryType<T extends keyof RegistryManagerData> =
  T extends "textures"
    ? TextureData
    : T extends "blocks"
      ? BlockData
      : T extends "items"
        ? ItemData
        : T extends "recipes"
          ? RecipeData
          : T extends "blockstates"
            ? BlockStateData
            : never;

export type RegistryManagerData = {
  textures: RegistryData<TextureData>;
  blocks: RegistryData<BlockData>;
  blockstates: RegistryData<BlockStateData>;
  items: RegistryData<ItemData>;
  recipes: RegistryData<RecipeData>;
};

/**
 * A centralized registry manager that groups multiple related registries together.
 * Provides type-safe access to different registries (textures, blocks, items, recipes)
 * and ensures consistent registration patterns across the entire game data system.
 *
 * This manager acts as a single source of truth for all game data registries,
 * making it easy to pass around a complete set of registries or access specific
 * ones by name.
 *
 * @template T - The registry map type defining which registries exist and their
 *                entry types. Typically this is `RegistryMap` which includes:
 *                - `textures`: TextureData entries
 *                - `blocks`: BlockData entries
 *                - `items`: ItemData entries
 *                - `recipes`: RecipeData entries
 */
export class RegistryManager {
  /**
   * Creates a new empty RegistryManager instance with all registries initialized.
   * Each registry starts empty and ready for registration.
   *
   * The registry structure is determined by the generic type parameter T,
   * which should define all registry names and their corresponding entry types.
   *
   * @returns A new RegistryManager instance with initialized empty registries.
   */
  static create(): RegistryManagerData {
    return {
      textures: Registry.create<TextureData>(),
      blocks: Registry.create<BlockData>(),
      blockstates: Registry.create<BlockStateData>(),
      items: Registry.create<ItemData>(),
      recipes: Registry.create<RecipeData>(),
    };
  }

  /**
   * Registers multiple entries into a specific registry within the manager.
   * Each entry will be automatically indexed by all its properties for
   * efficient O(1) lookups using the underlying Registry class.
   *
   * The entries are registered sequentially in the order provided. If an
   * entry fails validation or already exists, the registry may throw an error
   * depending on the underlying Registry implementation.
   *
   * This method is fluent and returns the manager instance for method chaining.
   *
   * @param registry - The name of the registry to add entries to. Must be a
   *                   key of the registry map type T.
   * @param entries - An array of entry objects to register. The `ID` field is
   *                  automatically added by the registry and should NOT be
   *                  included in these objects.
   * @returns The manager instance for fluent chaining.
   */
  static register<T extends keyof RegistryManagerData>(
    manager: RegistryManagerData,
    registry: T,
    entries: Omit<RegistryEntryType<T>, "ID">[],
  ) {
    const reg = manager[registry] as RegistryData<RegistryEntryType<T>>;

    for (let i = 0; i < entries.length; i++) {
      Registry.add(reg, entries[i]);
    }
  }
}

import { BlockStateData } from "./blockstate";
import { Registry, RegistryData } from "./registry";
import { TextureData } from "./texture";
import { ItemData, RecipeData } from "./types";
import { BlockData } from "./block";

export type BlockRegistry = RegistryData<BlockData>;
export type BlockStateRegistry = RegistryData<BlockStateData>;
export type ItemRegistry = RegistryData<ItemData>;
export type RecipeRegistry = RegistryData<RecipeData>;
export type TextureRegistry = RegistryData<TextureData>;

export type RegistryManagerData = {
  blocks: BlockRegistry;
  blockstates: BlockStateRegistry;
  items: ItemRegistry;
  recipes: RecipeRegistry;
  textures: TextureRegistry;
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
}

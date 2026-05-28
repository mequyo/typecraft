import { BlockProperties } from "../block-properties";
import { MESH } from "../mesh";
import { BlockRegistry } from "./block-registry";
import {
  AZALEA_LEAVES_DIG_SOUND,
  AZALEA_LEAVES_MINING_SOUND,
  STONE_DIG_SOUND,
  STONE_MINING_SOUND,
  WOOD_DIG_SOUND,
  WOOD_MINING_SOUND,
} from "./sounds";
import {
  AIR_TEXTURE,
  ANDESITE_TEXTURE,
  AZALEA_LEAVES_TEXTURE,
  BASALT_TEXTURE,
  BLACKSTONE_TEXTURE,
  BLUE_GLASS_TEXTURE,
  CALCITE_TEXTURE,
  CLAY_TEXTURE,
  COAL_ORE_TEXTURE,
  COARSE_DIRT_TEXTURE,
  COBBLESTONE_TEXTURE,
  COPPER_ORE_TEXTURE,
  CRAFTING_TABLE_FRONT_TEXTURE,
  CRAFTING_TABLE_SIDE_TEXTURE,
  CRAFTING_TABLE_TOP_TEXTURE,
  DEEPSLATE_COAL_ORE_TEXTURE,
  DEEPSLATE_COPPER_ORE_TEXTURE,
  DEEPSLATE_DIAMOND_ORE_TEXTURE,
  DEEPSLATE_EMERALD_ORE_TEXTURE,
  DEEPSLATE_GOLD_ORE_TEXTURE,
  DEEPSLATE_IRON_ORE_TEXTURE,
  DEEPSLATE_LAPIS_ORE_TEXTURE,
  DEEPSLATE_REDSTONE_ORE_TEXTURE,
  DEEPSLATE_TEXTURE,
  DIORITE_TEXTURE,
  DIRT_TEXTURE,
  DRIPSTONE_TEXTURE,
  EMERALD_ORE_TEXTURE,
  FLOWERING_AZALEA_TEXTURE,
  GLASS_TEXTURE,
  GOLD_ORE_TEXTURE,
  GRANITE_TEXTURE,
  GRASS_SIDE_TEXTURE,
  GRASS_TOP_TEXTURE,
  GRAVEL_TEXTURE,
  IRON_ORE_TEXTURE,
  LAPIS_ORE_TEXTURE,
  MOSS_BLOCK_TEXTURE,
  MOSSY_COBBLESTONE_TEXTURE,
  MUD_TEXTURE,
  OAK_LOG_SIDE_TEXTURE,
  OAK_LOG_TOP_TEXTURE,
  OAK_PLANKS_TEXTURE,
  PODZOL_TEXTURE,
  RED_SAND_TEXTURE,
  REDSTONE_ORE_TEXTURE,
  SAND_TEXTURE,
  SANDSTONE_TEXTURE,
  SNOW_TEXTURE,
  STONE_TEXTURE,
  TUFF_TEXTURE,
} from "./textures";

export const AIR = BlockRegistry.register({
  name: "air",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [AIR_TEXTURE],
  properties: [],
});
export const ANDESITE = BlockRegistry.register({
  name: "andesite",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [ANDESITE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const AZALEA_LEAVES = BlockRegistry.register({
  name: "azalea_leaves",
  meshID: MESH.OPAQUE_CUBE,
  hardness: 3,
  sounds: {
    dig: AZALEA_LEAVES_DIG_SOUND,
    mining: AZALEA_LEAVES_MINING_SOUND,
  },
  textures: [AZALEA_LEAVES_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const BASALT = BlockRegistry.register({
  name: "basalt",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [BASALT_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const BLACKSTONE = BlockRegistry.register({
  name: "blackstone",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [BLACKSTONE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const CALCITE = BlockRegistry.register({
  name: "calcite",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [CALCITE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const CLAY = BlockRegistry.register({
  name: "clay",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [CLAY_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const COAL_ORE = BlockRegistry.register({
  name: "coal_ore",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [COAL_ORE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const COARSE_DIRT = BlockRegistry.register({
  name: "coarse_dirt",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [COARSE_DIRT_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const COBBLESTONE = BlockRegistry.register({
  name: "cobblestone",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [COBBLESTONE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const COPPER_ORE = BlockRegistry.register({
  name: "copper_ore",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [COPPER_ORE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const CRAFTING_TABLE = BlockRegistry.register({
  name: "crafting_table",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: WOOD_DIG_SOUND,
    mining: WOOD_MINING_SOUND,
  },
  textures: [
    CRAFTING_TABLE_SIDE_TEXTURE,
    CRAFTING_TABLE_SIDE_TEXTURE,
    CRAFTING_TABLE_TOP_TEXTURE,
    CRAFTING_TABLE_SIDE_TEXTURE,
    CRAFTING_TABLE_FRONT_TEXTURE,
    CRAFTING_TABLE_SIDE_TEXTURE,
  ],
  properties: [BlockProperties.orientation],
});
export const DEEPSLATE_COAL_ORE = BlockRegistry.register({
  name: "deepslate_coal_ore",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [DEEPSLATE_COAL_ORE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const DEEPSLATE_COPPER_ORE = BlockRegistry.register({
  name: "deepslate_copper_ore",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [DEEPSLATE_COPPER_ORE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const DEEPSLATE_DIAMOND_ORE = BlockRegistry.register({
  name: "deepslate_diamond_ore",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [DEEPSLATE_DIAMOND_ORE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const DEEPSLATE_EMERALD_ORE = BlockRegistry.register({
  name: "deepslate_emerald_ore",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [DEEPSLATE_EMERALD_ORE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const DEEPSLATE_GOLD_ORE = BlockRegistry.register({
  name: "deepslate_gold_ore",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [DEEPSLATE_GOLD_ORE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const DEEPSLATE_IRON_ORE = BlockRegistry.register({
  name: "deepslate_iron_ore",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [DEEPSLATE_IRON_ORE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const DEEPSLATE_LAPIS_ORE = BlockRegistry.register({
  name: "deepslate_lapis_ore",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [DEEPSLATE_LAPIS_ORE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const DEEPSLATE_REDSTONE_ORE = BlockRegistry.register({
  name: "deepslate_redstone_ore",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [DEEPSLATE_REDSTONE_ORE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const DEEPSLATE = BlockRegistry.register({
  name: "deepslate",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [DEEPSLATE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const DIORITE = BlockRegistry.register({
  name: "diorite",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [DIORITE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const DIRT = BlockRegistry.register({
  name: "dirt",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [DIRT_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const DRIPSTONE = BlockRegistry.register({
  name: "dripstone",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [DRIPSTONE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const EMERALD_ORE = BlockRegistry.register({
  name: "emerald_ore",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [EMERALD_ORE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const FLOWERING_AZALEA = BlockRegistry.register({
  name: "flowering_azalea",
  meshID: MESH.OPAQUE_CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [FLOWERING_AZALEA_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const GLASS = BlockRegistry.register({
  name: "glass",
  meshID: MESH.OPAQUE_CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [GLASS_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const BLUE_GLASS = BlockRegistry.register({
  name: "blue_glass",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [BLUE_GLASS_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const GOLD_ORE = BlockRegistry.register({
  name: "gold_ore",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [GOLD_ORE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const GRANITE = BlockRegistry.register({
  name: "granite",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [GRANITE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const GRASS_BLOCK = BlockRegistry.register({
  name: "grass_block",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [
    GRASS_SIDE_TEXTURE,
    GRASS_SIDE_TEXTURE,
    GRASS_TOP_TEXTURE,
    DIRT_TEXTURE,
    GRASS_SIDE_TEXTURE,
    GRASS_SIDE_TEXTURE,
  ],
  properties: [BlockProperties.orientation],
});
export const GRAVEL = BlockRegistry.register({
  name: "gravel",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [GRAVEL_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const IRON_ORE = BlockRegistry.register({
  name: "iron_ore",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [IRON_ORE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const LAPIS_ORE = BlockRegistry.register({
  name: "lapis_ore",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [LAPIS_ORE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const MOSS_BLOCK = BlockRegistry.register({
  name: "moss_block",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [MOSS_BLOCK_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const MOSSY_COBBLESTONE = BlockRegistry.register({
  name: "mossy_cobblestone",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [MOSSY_COBBLESTONE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const MUD = BlockRegistry.register({
  name: "mud",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [MUD_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const OAK_LOG = BlockRegistry.register({
  name: "oak_log",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: WOOD_DIG_SOUND,
    mining: WOOD_MINING_SOUND,
  },
  textures: [
    OAK_LOG_SIDE_TEXTURE,
    OAK_LOG_SIDE_TEXTURE,
    OAK_LOG_TOP_TEXTURE,
    OAK_LOG_TOP_TEXTURE,
    OAK_LOG_SIDE_TEXTURE,
    OAK_LOG_SIDE_TEXTURE,
  ],
  properties: [BlockProperties.orientation],
});
export const OAK_FENCE = BlockRegistry.register({
  name: "oak_fence",
  meshID: MESH.FENCE,
  hardness: 3,
  sounds: {
    dig: WOOD_DIG_SOUND,
    mining: WOOD_MINING_SOUND,
  },
  textures: [OAK_PLANKS_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const OAK_SLAB = BlockRegistry.register({
  name: "oak_slab",
  meshID: MESH.SLAB,
  hardness: 3,
  sounds: {
    dig: WOOD_DIG_SOUND,
    mining: WOOD_MINING_SOUND,
  },
  textures: [OAK_PLANKS_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const PODZOL = BlockRegistry.register({
  name: "podzol",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [PODZOL_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const RED_SAND = BlockRegistry.register({
  name: "red_sand",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [RED_SAND_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const REDSTONE_ORE = BlockRegistry.register({
  name: "redstone_ore",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [REDSTONE_ORE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const SAND = BlockRegistry.register({
  name: "sand",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [SAND_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const SANDSTONE = BlockRegistry.register({
  name: "sandstone",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [SANDSTONE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const SNOW = BlockRegistry.register({
  name: "snow",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [SNOW_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const STONE = BlockRegistry.register({
  name: "stone",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [STONE_TEXTURE],
  properties: [BlockProperties.orientation],
});
export const TUFF = BlockRegistry.register({
  name: "tuff",
  meshID: MESH.CUBE,
  hardness: 3,
  sounds: {
    dig: STONE_DIG_SOUND,
    mining: STONE_MINING_SOUND,
  },
  textures: [TUFF_TEXTURE],
  properties: [BlockProperties.orientation],
});

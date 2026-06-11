import { BlockProperty } from "./block-properties";
import { RegEntry, Registry, RegistryData } from "./registry";
import { TextureData, TextureName } from "./texture";
import { Sixtuple } from "./types";

type Material =
  | "none"
  | "stone"
  | "wood"
  | "metal"
  | "dirt"
  | "sand"
  | "wool"
  | "leaves"
  | "glass";
type Tool = "pickaxe" | "shovel" | "axe" | "sword" | "hoe";
type BlockTexture = [RegEntry<TextureData>] | Sixtuple<RegEntry<TextureData>>;
export type BlockData = {
  name: string;
  display: string;
  meshID: number;
  textures: BlockTexture;
  hardness: number;
  material: Material;
  tool?: Tool;
  properties: BlockProperty[];
};

export class Block {
  static create(
    reg: RegistryData<TextureData>,
    data: {
      name: string;
      meshID: number;
      textures: [TextureName] | Sixtuple<TextureName>;
      hardness: number;
      material: Material;
      tool?: Tool;
      properties: BlockProperty[];
    },
  ): BlockData {
    return {
      ...data,
      display: data.name
        .split("_")
        .map((val) => {
          String(val).charAt(0).toUpperCase() + String(val).slice(1);
        })
        .join(" "),
      textures: data.textures.map((t) =>
        Registry.get(reg, "name", t),
      ) as BlockTexture,
    };
  }
}

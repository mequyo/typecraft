import { BlockProperty } from "../block-properties";
import { MeshID } from "../mesh";
import { Sound } from "./sound-registry";
import { Texture } from "./texture-registry";

export type BlockID = number;

export type BlockDefinition = {
  name: string;
  meshID: MeshID;
  hardness: number;
  textures: [Texture] | [Texture, Texture, Texture, Texture, Texture, Texture];
  sounds: {
    dig: Sound[];
    mining: Sound[];
  };
  properties: BlockProperty[];
};

export type Block = BlockDefinition & {
  ID: BlockID;
};

export class BlockRegistry {
  private static blocks: Block[] = [];

  static register(definition: BlockDefinition): Block {
    const block: Block = { ...definition, ID: this.blocks.length };

    this.blocks.push(block);
    return block;
  }

  static get(block: BlockID): Block {
    return this.blocks[block];
  }

  static getAll(): Block[] {
    return this.blocks;
  }
}

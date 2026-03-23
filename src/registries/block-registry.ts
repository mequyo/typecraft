import { FACE, MeshID } from "../mesh"
import { Sound } from "./sound-registry"
import { Texture } from "./texture-registry"

export type BlockID = number

export type BlockDefinition = {
  name: string
  meshID: MeshID
  hardness: number
  textures: [Texture] | [Texture, Texture, Texture, Texture, Texture, Texture]
  sounds: {
    dig: Sound[]
    mining: Sound[]
  }
}

export type Block = BlockDefinition & {
  ID: BlockID
  topview: [number, number, number, number]
}

export class BlockRegistry {
  private static blocks: Block[] = []

  static register(definition: BlockDefinition): Block {
    const topview = definition.textures[FACE.PY % definition.textures.length].average!;
    const block: Block = { ...definition, ID: this.blocks.length, topview };

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
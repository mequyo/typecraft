import { BlockID } from "./block-registry"

export type BlockStateID = number

export type Orientation = number // 0 - 23 

export type BlockStateHash = number // currently encodes blockID + Orientation, later we can add redstone signal and other stuff

export type BlockState = {
  block: BlockID
  orientation: Orientation
}

export class BlockStateRegistry {

  // Turns a BlockState into a hash, Uint16Array [11 bits of blockID, 5 bits of orientation]
  static encode(block: BlockID, orientation: Orientation): BlockStateHash {
    // 11 bits for blockID, 5 bits for orientation -> total 16 bits
    return ((block & 0x7FF) << 5) | (orientation & 0x1F);
  }

  // Decode the hash back into blockID + orientation
  static decode(hash: BlockStateHash): BlockState {
    const block = (hash >>> 5) & 0x7FF;
    const orientation = hash & 0x1F;
    return { block, orientation };
  }
}
import { BlockRegistry } from "./block-registry";
import { BlockProperty } from "../block-properties";

export type BlockStateHash = number;

type PropertyCodec = {
  size: number;
  toIndex: (value: any) => number;
  fromIndex: (idx: number) => any;
};

type BlockStateInfo = {
  blockID: number;
  baseOffset: number;
  numStates: number;
  properties: readonly BlockProperty[];
  codecs: PropertyCodec[];
};

type BlockRange = {
  blockID: number;
  start: number;
  end: number;
};

export class BlockStateRegistry {
  private static blockInfo = new Map<number, BlockStateInfo>(); // BlockID -> Properties
  private static ranges: BlockRange[] = [];
  private static totalStates = 0;
  private static built = false;

  static build(): void {
    if (this.built) return;

    const blocks = BlockRegistry.getAll();
    let offset = 0;

    for (const block of blocks) {
      const props = block.properties;

      const codecs: PropertyCodec[] = [];

      for (const prop of props) {
        if (prop.type === "bool") {
          codecs.push({
            size: 2,
            toIndex: (v: boolean) => (v ? 1 : 0),
            fromIndex: (i: number) => i === 1,
          });
        } else if (prop.type === "int") {
          codecs.push({
            size: prop.max - prop.min + 1,
            toIndex: (v: number) => {
              if (v < prop.min || v > prop.max) {
                throw new Error(`Out of range ${prop.name}`);
              }
              return v - prop.min;
            },
            fromIndex: (i: number) => prop.min + i,
          });
        } else if (prop.type === "enum") {
          const map = new Map<string, number>();
          prop.values.forEach((v, i) => map.set(v, i));

          codecs.push({
            size: prop.values.length,
            toIndex: (v: string) => {
              const idx = map.get(v);
              if (idx === undefined) {
                throw new Error(`Invalid enum ${v} for ${prop.name}`);
              }
              return idx;
            },
            fromIndex: (i: number) => prop.values[i],
          });
        }
      }

      const numStates = codecs.reduce((a, c) => a * c.size, 1);

      this.blockInfo.set(block.ID, {
        blockID: block.ID,
        baseOffset: offset,
        numStates,
        properties: props,
        codecs,
      });

      this.ranges.push({
        blockID: block.ID,
        start: offset,
        end: offset + numStates,
      });

      offset += numStates;
    }

    this.totalStates = offset;
    this.built = true;
  }

  static encode(
    blockId: number,
    properties: Record<string, any>,
  ): BlockStateHash {
    if (!this.built) throw new Error("Registry not built");

    const info = this.blockInfo.get(blockId);
    if (!info) throw new Error(`Unknown block ${blockId}`);

    let local = 0;
    let stride = 1;

    for (let i = info.codecs.length - 1; i >= 0; i--) {
      const prop = info.properties[i];
      const codec = info.codecs[i];

      const value = properties[prop.name];

      if (value === undefined) {
        throw new Error(`Missing property ${prop.name} for ${blockId}`);
      }

      const idx = codec.toIndex(value);

      if (idx < 0 || idx >= codec.size) {
        throw new Error(`Invalid value for ${prop.name}`);
      }

      local += idx * stride;
      stride *= codec.size;
    }

    return info.baseOffset + local;
  }

  static decode(hash: BlockStateHash): {
    blockID: number;
    properties: Record<string, any>;
  } {
    if (!this.built) throw new Error("Registry not built");
    if (hash < 0 || hash >= this.totalStates) {
      throw new Error("Out of range state hash");
    }

    const block = this.findBlock(hash);
    const info = this.blockInfo.get(block.blockID)!;

    let local = hash - block.start;
    const props: Record<string, any> = {};

    for (let i = 0; i < info.codecs.length; i++) {
      const codec = info.codecs[i];
      const prop = info.properties[i];

      const valueIndex = local % codec.size;
      local = Math.floor(local / codec.size);

      props[prop.name] = codec.fromIndex(valueIndex);
    }

    return {
      blockID: block.blockID,
      properties: props,
    };
  }

  private static findBlock(hash: number): BlockRange {
    // binary search over ranges
    let lo = 0;
    let hi = this.ranges.length - 1;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const r = this.ranges[mid];

      if (hash < r.start) {
        hi = mid - 1;
      } else if (hash >= r.end) {
        lo = mid + 1;
      } else {
        return r;
      }
    }

    throw new Error("Block range not found (corrupt registry)");
  }
}

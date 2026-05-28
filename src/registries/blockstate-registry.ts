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

type CachedBlockState = {
  readonly blockID: number;
  readonly properties: Readonly<Record<string, any>>;
};

export class BlockStateRegistry {
  private static blockInfo = new Map<number, BlockStateInfo>(); // BlockID -> Properties
  private static ranges: BlockRange[] = [];
  private static totalStates = 0;
  private static built = false;

  // Global cache mapping hash -> cached state (with readonly properties)
  private static globalStateCache: CachedBlockState[] = [];

  // Per-block cache for fast encoding validation
  private static blockStateCache = new Map<
    number,
    Readonly<Record<string, any>>[]
  >();

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

      // Pre-compute all states for this block
      this.precomputeBlockStates(block.ID, numStates, props, codecs, offset);

      offset += numStates;
    }

    this.totalStates = offset;
    this.built = true;
  }

  private static precomputeBlockStates(
    blockID: number,
    numStates: number,
    properties: readonly BlockProperty[],
    codecs: PropertyCodec[],
    baseOffset: number,
  ): void {
    const blockStates: Readonly<Record<string, any>>[] = new Array(numStates);

    // Generate all possible state combinations
    const indices = new Array(properties.length).fill(0);

    for (let stateIdx = 0; stateIdx < numStates; stateIdx++) {
      const props: Record<string, any> = {};

      // Decode the current indices into property values
      for (let i = 0; i < properties.length; i++) {
        props[properties[i].name] = codecs[i].fromIndex(indices[i]);
      }

      const frozenProps = Object.freeze(props);
      const globalHash = baseOffset + stateIdx;

      // Store in per-block cache
      blockStates[stateIdx] = frozenProps;

      // Store in global cache
      this.globalStateCache[globalHash] = {
        blockID,
        properties: frozenProps,
      };

      // Increment indices (like a mixed-radix counter)
      for (let i = properties.length - 1; i >= 0; i--) {
        indices[i]++;
        if (indices[i] < codecs[i].size) {
          break;
        }
        indices[i] = 0;
      }
    }

    this.blockStateCache.set(blockID, blockStates);
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

  static decode(hash: BlockStateHash): CachedBlockState {
    if (!this.built) throw new Error("Registry not built");
    if (hash < 0 || hash >= this.totalStates) {
      throw new Error("Out of range state hash");
    }

    // O(1) lookup - just return the pre-computed cached state
    return this.globalStateCache[hash];
  }

  // Optional: Fast lookup for all states of a specific block type
  static getBlockStates(
    blockID: number,
  ): readonly Readonly<Record<string, any>>[] {
    if (!this.built) throw new Error("Registry not built");

    const states = this.blockStateCache.get(blockID);
    if (!states) throw new Error(`Unknown block ${blockID}`);

    return states;
  }

  // Optional: Get the total number of states
  static getTotalStates(): number {
    if (!this.built) throw new Error("Registry not built");
    return this.totalStates;
  }
}

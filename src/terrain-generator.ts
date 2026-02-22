// Implement OpenSimplex [-1;1]
// Implement Worley noise
// Use blended Voronoi noise to get biome percentages
// Use FBM to get somewhat realistic looking heights for 3D terrain
// Use Worley noise to generate caves
// Get slope and biome at a given point to determine material
// Convert Material plus factors like "underground" to get specific block

import { CHUNK_SIZE, NOISE_LACUNARITY, NOISE_OCTAVES, NOISE_PERSISTENCE, NOISE_SCALE, NOISE_SEED, TERRAIN_HEIGHT } from "./constants";
import { Simplex2D } from "./classes/simplex2D";
import { ORIENTATION } from "./mesh";
import { Block } from "./registries/block-registry";
import { AIR, ANDESITE, AZALEA_LEAVES, BLACKSTONE, CLAY, COARSE_DIRT, DEEPSLATE, DIORITE, DIRT, GLASS, GRASS_BLOCK, GRAVEL, MOSS_BLOCK, OAK_FENCE, OAK_SLAB, SNOW, STONE, TUFF } from "./registries/blocks";
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { Vec3 } from "wgpu-matrix";
import { Chunk } from "./chunk";



type Material = {
  block: Block,
  minHeight?: number,    // optional
  maxHeight?: number,    // optional
  slopeRange?: [number, number], // 0 = flat, 1 = vertical
  probability?: number,  // for some variation
}

const PLAINS_MATERIALS: Material[] = [
  { block: GRASS_BLOCK /* should be grass */, minHeight: 0, maxHeight: TERRAIN_HEIGHT, slopeRange: [0, 0.3] },   // mostly flat
  { block: OAK_SLAB, minHeight: 0, maxHeight: TERRAIN_HEIGHT, slopeRange: [0, 1] },
  { block: STONE, minHeight: 5, slopeRange: [0.3, 1] },
  { block: AZALEA_LEAVES, slopeRange: [0.5, 1], probability: 0.2 },
  { block: DIORITE, slopeRange: [0.5, 1], probability: 0.1 },
  { block: ANDESITE, slopeRange: [0.5, 1], probability: 0.1 },
  { block: GRAVEL, slopeRange: [0.6, 1], probability: 0.2 },
  { block: SNOW, minHeight: TERRAIN_HEIGHT * 0.8, slopeRange: [0, 1], probability: 0.3 },
  { block: COARSE_DIRT, slopeRange: [0.3, 0.5], probability: 0.2 },
  { block: MOSS_BLOCK, slopeRange: [0, 0.2], probability: 0.05 },
  { block: BLACKSTONE, minHeight: 0, maxHeight: TERRAIN_HEIGHT * 0.3, probability: 0.1 },
  { block: MOSS_BLOCK, minHeight: TERRAIN_HEIGHT * 0.5, probability: 0.05 },
  { block: DEEPSLATE, minHeight: TERRAIN_HEIGHT * 0.2, maxHeight: TERRAIN_HEIGHT * 0.5, probability: 0.05 },
];


function computeSlope(heightmap: Uint8Array, x: number, z: number): number {
  const h = heightmap[x * CHUNK_SIZE + z];
  const dx = (heightmap[(x + 1) * CHUNK_SIZE + z] ?? h) - (heightmap[(x - 1) * CHUNK_SIZE + z] ?? h);
  const dz = (heightmap[x * CHUNK_SIZE + z + 1] ?? h) - (heightmap[x * CHUNK_SIZE + z - 1] ?? h);
  return Math.sqrt(dx * dx + dz * dz); // approximate slope (0 = flat)
}

function pickMaterial(materials: Material[], height: number, slope: number): Block {
  const candidates = materials.filter(m => {
    if (m.minHeight !== undefined && height < m.minHeight) return false;
    if (m.maxHeight !== undefined && height > m.maxHeight) return false;
    if (m.slopeRange && (slope < m.slopeRange[0] || slope > m.slopeRange[1])) return false;
    return true;
  });

  if (candidates.length === 0) return DIRT;

  // Weight by probability if defined
  let probability = 0;
  for (const c of candidates) probability += c.probability ?? 1;
  let r = Math.random() * probability; // TODO pseudo random based on seed

  for (const c of candidates) {
    r -= c.probability ?? 1;
    if (r <= 0) return c.block;
  }

  return candidates[0].block;
}


export class TerrainGenerator {
  public simplex = new Simplex2D(NOISE_SEED);

  generateBlocks(coffset: Vec3): { blocks: Uint16Array, heightmap: Uint8Array, amount: number } {
    const blocks = new Uint16Array(CHUNK_SIZE ** 3).fill(BlockStateRegistry.encode(AIR.ID, ORIENTATION.NX_0));
    const heightmap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    let amount = 0;

    // Fill heightmap
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = x + coffset[0] * CHUNK_SIZE;

      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wz = z + coffset[2] * CHUNK_SIZE;
        const height = this.fbm(wx, wz);
        heightmap[x * CHUNK_SIZE + z] = height;
      }
    }

    // Pick block
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = x + coffset[0] * CHUNK_SIZE;

      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wz = z + coffset[2] * CHUNK_SIZE;
        const height = heightmap[x * CHUNK_SIZE + z];
        const slope = computeSlope(heightmap, x, z);

        for (let y = 0; y < CHUNK_SIZE; y++) {
          const wy = y + coffset[1] * CHUNK_SIZE;

          if (wy > height) break;

          const index = Chunk.pack(x, y, z);
          const block = pickMaterial(PLAINS_MATERIALS, wy, slope);
          const orientation = block.name == "oak_fence" ? ORIENTATION.NX_0 : ORIENTATION.PX_0;
          const blockstate = BlockStateRegistry.encode(block.ID, orientation);
          blocks[index] = blockstate;

          if (block.ID != AIR.ID) amount += 1;
        }
      }
    }

    return { blocks, heightmap, amount };
  }


  fbm(wx: number, wz: number) {
    let amplitude = 1;
    let frequency = NOISE_SCALE;
    let height = 0;
    let max = 0;

    for (let i = 0; i < NOISE_OCTAVES; i++) {
      height += this.simplex.noise(wx * frequency, wz * frequency) * amplitude;
      max += amplitude;
      amplitude *= NOISE_PERSISTENCE;
      frequency *= NOISE_LACUNARITY;
    }

    return height / max * TERRAIN_HEIGHT; // Normalize from [0, height] to [0, 1], then multiply by TERRAIN_HEIGHT
  }
}
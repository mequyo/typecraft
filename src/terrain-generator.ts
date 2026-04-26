import {
  CHUNK_SIZE,
  NOISE_LACUNARITY,
  NOISE_OCTAVES,
  NOISE_PERSISTENCE,
  NOISE_SCALE,
  NOISE_SEED,
  TERRAIN_HEIGHT,
} from "./constants";
import { ORIENTATION } from "./mesh";
import { Block } from "./registries/block-registry";
import {
  AIR,
  BLUE_GLASS,
  COBBLESTONE,
  DEEPSLATE,
  DIORITE,
  DIRT,
  GRANITE,
  GRASS_BLOCK,
  GRAVEL,
  MUD,
  MOSS_BLOCK,
  PODZOL,
  RED_SAND,
  SAND,
  SANDSTONE,
  SNOW,
  STONE,
  TUFF,
} from "./registries/blocks";
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { Simplex2D } from "./classes/simplex2D";
import { Vec3 } from "wgpu-matrix";
import { Chunk } from "./chunk";

// ── Noise tuning ───────────────────────────────────────────────────────────────
const DOMAIN_WARP_SCALE = 0.015;
const DOMAIN_WARP_AMP   = 14;

const CONTINENT_SCALE   = 0.004; // large landmasses
const CONTINENT_OCTAVES = 3;

const EROSION_SCALE     = 0.012; // valleys / river channels
const EROSION_OCTAVES   = 4;

const BIOME_SCALE       = 0.003; // smooth biome field
const BIOME_OCTAVES     = 2;

const STRATA_WARP       = 14;
const SEA_LEVEL         = TERRAIN_HEIGHT - 10;
const SLOPE_DELTA       = 2;     // world-space sample distance for gradient

// ── Strata layer ───────────────────────────────────────────────────────────────
type StrataLayer = {
  block: Block;
  minDepth?: number;
  maxDepth?: number;
  strataHz?: number;   // sine cycles across TERRAIN_HEIGHT
  strataAmp?: number;  // fraction of band occupied by this block [0,1]
};

// ── Biome definition ───────────────────────────────────────────────────────────
type BiomeDef = {
  name: string;
  baseHeight: number;        // average surface y
  amplitude: number;         // fbm variation
  erosionStrength: number;   // how aggressively the erosion mask cuts (0..1)
  continentalFactor: number; // how much continent noise boosts height (0..2)
  surfaceBlock: Block;       // top block on gentle ground
  steepBlock: Block;         // top block on cliffs
  strata: StrataLayer[];
};

// ── Biome layout ───────────────────────────────────────────────────────────────
// A single low-frequency noise value in [0,1] drives biome selection.
// Margins around thresholds create smooth transition zones where every
// terrain property (height, amplitude, erosion, strata palette) is interpolated.
const BIOME_THRESHOLDS = [0.33, 0.43, 0.54, 0.65];
const BIOME_MARGIN     = 0.05;

const BIOMES: BiomeDef[] = [
  // 0 ─ Ocean ─────────────────────────────────────────────────────────────────
  {
    name: "ocean",
    baseHeight: TERRAIN_HEIGHT - 18,
    amplitude: 4,
    erosionStrength: 0.1,
    continentalFactor: 0.3,
    surfaceBlock: SAND,
    steepBlock: GRAVEL,
    strata: [
      { block: SAND, maxDepth: 2 },
      { block: MUD, minDepth: 1, maxDepth: 5, strataHz: 5, strataAmp: 0.4 },
      { block: GRAVEL, minDepth: 3, maxDepth: 8, strataHz: 4, strataAmp: 0.3 },
      { block: STONE, minDepth: 6 },
    ],
  },

  // 1 ─ Desert ────────────────────────────────────────────────────────────────
  {
    name: "desert",
    baseHeight: TERRAIN_HEIGHT - 6,
    amplitude: 8,
    erosionStrength: 0.3,
    continentalFactor: 0.8,
    surfaceBlock: SAND,
    steepBlock: SANDSTONE,
    strata: [
      { block: RED_SAND, maxDepth: 0, strataHz: 6, strataAmp: 0.35 },
      { block: SAND, maxDepth: 3 },
      { block: RED_SAND, minDepth: 2, maxDepth: 6, strataHz: 8, strataAmp: 0.45 },
      { block: SANDSTONE, minDepth: 4 },
    ],
  },

  // 2 ─ Plains ────────────────────────────────────────────────────────────────
  {
    name: "plains",
    baseHeight: TERRAIN_HEIGHT + 2,
    amplitude: 10,
    erosionStrength: 0.4,
    continentalFactor: 1.0,
    surfaceBlock: GRASS_BLOCK,
    steepBlock: GRAVEL,
    strata: [
      { block: GRASS_BLOCK, maxDepth: 0 },
      { block: MOSS_BLOCK, maxDepth: 0, strataHz: 10, strataAmp: 0.25 },
      { block: PODZOL, maxDepth: 0, strataHz: 6, strataAmp: 0.15 },
      { block: DIRT, minDepth: 1, maxDepth: 4 },
      { block: MUD, minDepth: 2, maxDepth: 6, strataHz: 5, strataAmp: 0.35 },
      { block: STONE, minDepth: 5 },
    ],
  },

  // 3 ─ Mountains ───────────────────────────────────────────────────────────────
  {
    name: "mountains",
    baseHeight: TERRAIN_HEIGHT + 28,
    amplitude: 35,
    erosionStrength: 0.85,
    continentalFactor: 1.6,
    surfaceBlock: SNOW,
    steepBlock: STONE,
    strata: [
      { block: SNOW, maxDepth: 0 },
      { block: GRAVEL, maxDepth: 1, strataHz: 8, strataAmp: 0.25 },
      { block: STONE, minDepth: 1, maxDepth: 12 },
      { block: TUFF, minDepth: 3, maxDepth: 14, strataHz: 14, strataAmp: 0.40 },
      { block: COBBLESTONE, minDepth: 6, maxDepth: 20, strataHz: 10, strataAmp: 0.30 },
      { block: GRANITE, minDepth: 10, maxDepth: 30, strataHz: 7, strataAmp: 0.35 },
      { block: DEEPSLATE, minDepth: 24 },
    ],
  },

  // 4 ─ Snow / Alpine ───────────────────────────────────────────────────────────
  {
    name: "snow",
    baseHeight: TERRAIN_HEIGHT + 14,
    amplitude: 18,
    erosionStrength: 0.6,
    continentalFactor: 1.3,
    surfaceBlock: SNOW,
    steepBlock: STONE,
    strata: [
      { block: SNOW, maxDepth: 1 },
      { block: STONE, minDepth: 1, maxDepth: 10 },
      { block: TUFF, minDepth: 4, maxDepth: 14, strataHz: 12, strataAmp: 0.35 },
      { block: DEEPSLATE, minDepth: 10 },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Terrain Generator ──────────────────────────────────────────────────────────
export class TerrainGenerator {
  private simplex = new Simplex2D(NOISE_SEED);
  private erosionSimplex = new Simplex2D(NOISE_SEED ^ 0x8badf00d);
  private strataSimplex = new Simplex2D(NOISE_SEED ^ 0xdeadbeef);

  // Standard FBM in [0,1]
  private fbm(
    wx: number,
    wz: number,
    octaves: number,
    scale: number
  ): number {
    let amp = 1, freq = scale, val = 0, max = 0;
    for (let i = 0; i < octaves; i++) {
      val += this.simplex.noise(wx * freq, wz * freq) * amp;
      max += amp;
      amp *= NOISE_PERSISTENCE;
      freq *= NOISE_LACUNARITY;
    }
    return (val / max);
  }

  // Domain warp: distort sample coordinates before feeding them to the main FBM
  private domainWarp(wx: number, wz: number): [number, number] {
    const dx = this.simplex.noise(wx * DOMAIN_WARP_SCALE + 17.1, wz * DOMAIN_WARP_SCALE + 31.7);
    const dz = this.simplex.noise(wx * DOMAIN_WARP_SCALE + 53.3, wz * DOMAIN_WARP_SCALE + 11.9);
    return [
      wx + dx * DOMAIN_WARP_AMP,
      wz + dz * DOMAIN_WARP_AMP,
    ];
  }

  // Large, smooth continent shapes that modulate amplitude
  private continentNoise(wx: number, wz: number): number {
    return this.fbm(wx, wz, CONTINENT_OCTAVES, CONTINENT_SCALE);
  }

  // Ridged multifractal: high values = deep valleys / scoured channels
  private erosionNoise(wx: number, wz: number): number {
    let amp = 1, freq = EROSION_SCALE, val = 0, max = 0;
    for (let i = 0; i < EROSION_OCTAVES; i++) {
      const n = this.erosionSimplex.noise(wx * freq, wz * freq);
      const ridged = 1 - Math.abs(n);
      val += ridged * ridged * amp; // square to sharpen valleys
      max += amp;
      amp *= NOISE_PERSISTENCE;
      freq *= NOISE_LACUNARITY;
    }
    return val / max; // [0,1]
  }

  // Low-frequency field that selects biomes
  private biomeField(wx: number, wz: number): number {
    return this.fbm(wx + 512, wz + 512, BIOME_OCTAVES, BIOME_SCALE);
  }

  // Given a biome field value b in [0,1], return two biomes and a blend factor.
  private getBiomeBlend(b: number): { a: BiomeDef; b: BiomeDef; t: number } {
    // Solid: below first threshold
    if (b < BIOME_THRESHOLDS[0] - BIOME_MARGIN) {
      return { a: BIOMES[0], b: BIOMES[0], t: 0 };
    }
    // Solid: above last threshold
    if (b >= BIOME_THRESHOLDS[BIOME_THRESHOLDS.length - 1] + BIOME_MARGIN) {
      return { a: BIOMES[BIOMES.length - 1], b: BIOMES[BIOMES.length - 1], t: 0 };
    }
    // Transition zone around a threshold
    for (let i = 0; i < BIOME_THRESHOLDS.length; i++) {
      const thr = BIOME_THRESHOLDS[i];
      const start = thr - BIOME_MARGIN;
      const end = thr + BIOME_MARGIN;
      if (b >= start && b <= end) {
        return { a: BIOMES[i], b: BIOMES[i + 1], t: smoothstep(start, end, b) };
      }
    }
    // Solid region between two thresholds
    for (let i = 0; i < BIOME_THRESHOLDS.length - 1; i++) {
      if (b >= BIOME_THRESHOLDS[i] + BIOME_MARGIN && b < BIOME_THRESHOLDS[i + 1] - BIOME_MARGIN) {
        return { a: BIOMES[i + 1], b: BIOMES[i + 1], t: 0 };
      }
    }
    return { a: BIOMES[0], b: BIOMES[0], t: 0 };
  }

  // Evaluate the full surface for a single world column.
  private surfaceColumn(wx: number, wz: number): {
    y: number;
    blend: { a: BiomeDef; b: BiomeDef; t: number };
    erosion: number;
    warpNoise: number;
  } {
    const [warpedX, warpedZ] = this.domainWarp(wx, wz);
    const baseNoise = this.fbm(warpedX, warpedZ, NOISE_OCTAVES, NOISE_SCALE);
    const continent = this.continentNoise(wx, wz);
    const erosion = this.erosionNoise(wx, wz);
    const bField = this.biomeField(wx, wz);
    const blend = this.getBiomeBlend(bField);

    const baseH = lerp(blend.a.baseHeight, blend.b.baseHeight, blend.t);
    const amp = lerp(blend.a.amplitude, blend.b.amplitude, blend.t);
    const eroStr = lerp(blend.a.erosionStrength, blend.b.erosionStrength, blend.t);
    const contFactor = lerp(blend.a.continentalFactor, blend.b.continentalFactor, blend.t);

    // Multiplicative continental shaping: amplifies landmasses, suppresses basins
    const continentalBoost = lerp(0.3, 1.5, continent * contFactor);
    let elevation = baseNoise * amp * continentalBoost;

    // Subtractive erosion: biomes with high erosionStrength get deep valleys
    elevation -= erosion * eroStr * amp * 0.6;

    const y = Math.round(baseH + elevation);
    const warpNoise = this.strataSimplex.noise(wx * 0.025, wz * 0.025);
    return { y, blend, erosion, warpNoise };
  }

  // Pick a block for a single voxel.
  private pickBlock(
    biome: BiomeDef,
    depth: number,
    wy: number,
    warpNoise: number,
    slope: number,
    erosion: number
  ): Block {
    // Slope scouring: cliffs strip surface layers and expose deeper material
    const slopeDepth = depth + Math.max(0, (slope - 0.6) * 3);

    // Surface block selection: slope and erosion override gentle topsoil
    if (depth <= 1) {
      if (slope > 0.75) return biome.steepBlock;
      if (erosion > 0.7 && depth === 0) return GRAVEL; // scoured / alluvial
      if (depth === 0) return biome.surfaceBlock;
    }

    // Strata selection with vertical warping (pinch & bulge)
    for (const layer of biome.strata) {
      if (layer.minDepth !== undefined && slopeDepth < layer.minDepth) continue;
      if (layer.maxDepth !== undefined && slopeDepth > layer.maxDepth) continue;

      if (layer.strataHz !== undefined && layer.strataAmp !== undefined) {
        const warpedY = wy + warpNoise * STRATA_WARP;
        const s = (Math.sin((warpedY / TERRAIN_HEIGHT) * Math.PI * layer.strataHz) + 1) / 2;
        if (s < 1 - layer.strataAmp) continue;
      }
      return layer.block;
    }

    return biome.strata[biome.strata.length - 1].block;
  }

  generateBlocks(coffset: Vec3): { blocks: Uint16Array; heightmap: Uint8Array; amount: number } {
    const blocks = new Uint16Array(CHUNK_SIZE ** 3).fill(
      BlockStateRegistry.encode(AIR.ID, ORIENTATION.NX_0)
    );
    const heightmap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    let amount = 0;

    const chunkY0 = coffset[1] * CHUNK_SIZE;
    const airCode = BlockStateRegistry.encode(AIR.ID, ORIENTATION.NX_0);
    const waterCode = BlockStateRegistry.encode(BLUE_GLASS.ID, ORIENTATION.NX_0);

    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = x + coffset[0] * CHUNK_SIZE;

      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wz = z + coffset[2] * CHUNK_SIZE;

        const here = this.surfaceColumn(wx, wz);
        const nextX = this.surfaceColumn(wx + SLOPE_DELTA, wz);
        const nextZ = this.surfaceColumn(wx, wz + SLOPE_DELTA);

        const slope = Math.sqrt(
          (here.y - nextX.y) ** 2 + (here.y - nextZ.y) ** 2
        ) / SLOPE_DELTA;

        // Use the dominant biome for discrete block choices.
        // Because heights are already blended, the visual transition is smooth.
        const dominant = here.blend.t < 0.5 ? here.blend.a : here.blend.b;
        const surfaceY = here.y;

        heightmap[x * CHUNK_SIZE + z] = clamp(surfaceY, 0, 255);

        for (let y = 0; y < CHUNK_SIZE; y++) {
          const wy = y + chunkY0;
          const index = Chunk.pack(x, y, z);

          // Water fill: anything below sea level that isn't solid terrain becomes water
          if (wy > surfaceY && wy <= SEA_LEVEL) {
            blocks[index] = waterCode;
            amount++;
            continue;
          }
          if (wy > surfaceY) continue;

          const depth = surfaceY - wy;
          const block = this.pickBlock(
            dominant,
            depth,
            wy,
            here.warpNoise,
            slope,
            here.erosion
          );
          blocks[index] = BlockStateRegistry.encode(block.ID, ORIENTATION.PX_0);
          amount++;
        }
      }
    }

    // TODO: decorator pass (trees, ores, etc.) after terrain so they only overwrite air

    return { blocks, heightmap, amount };
  }
}
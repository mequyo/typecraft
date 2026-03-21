import { CHUNK_SIZE, NOISE_LACUNARITY, NOISE_OCTAVES, NOISE_PERSISTENCE, NOISE_SCALE, NOISE_SEED, TERRAIN_HEIGHT } from "./constants";
import { ORIENTATION } from "./mesh";
import { Block } from "./registries/block-registry";
import {
  AIR, AZALEA_LEAVES, BLUE_GLASS, COBBLESTONE, DEEPSLATE, DIORITE, DIRT,
  GRANITE, GRASS_BLOCK, GRAVEL, MUD, MOSS_BLOCK, OAK_LOG, PODZOL,
  RED_SAND, SAND, SANDSTONE, SNOW, STONE, TUFF,
} from "./registries/blocks";
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { Simplex2D } from "./classes/simplex2D";
import { Vec3 } from "wgpu-matrix";
import { Chunk } from "./chunk";

// ── Hex grid parameters ────────────────────────────────────────────────────────
const HEX_RADIUS = 64;
const BORDER_WIDTH = 3;
const FADE_WIDTH = 20;

// ── Strata layer ───────────────────────────────────────────────────────────────
// Layers are tested top-to-bottom. The first one whose conditions pass wins.
//   minDepth : voxels below the surface (0 = top face)
//   maxDepth : voxels below the surface (undefined = no lower limit)
//   strataHz : cycles per TERRAIN_HEIGHT — creates horizontal banding when set
//   strataAmp: how strong the strata sine is (0 = off, 1 = full band switching)
type StrataLayer = {
  block: Block;
  minDepth?: number;
  maxDepth?: number;
  strataHz?: number;  // sine cycles across TERRAIN_HEIGHT
  strataAmp?: number;  // fraction of band occupied by this block [0,1]
};

// ── Biome definitions ──────────────────────────────────────────────────────────
type BiomeDef = {
  baseHeight: number;
  variance: number;
  amplitude: number;
  strata: StrataLayer[];
};

const BIOMES: BiomeDef[] = [
  // ── Plains ────────────────────────────────────────────────────────────────
  {
    baseHeight: TERRAIN_HEIGHT,
    variance: 4,
    amplitude: 6,
    strata: [
      { block: GRASS_BLOCK, maxDepth: 0 }, // top face
      { block: MOSS_BLOCK, maxDepth: 0, strataHz: 8, strataAmp: 0.25 }, // patchy moss
      { block: PODZOL, maxDepth: 0, strataHz: 5, strataAmp: 0.15 }, // podzol patches
      { block: DIRT, minDepth: 1, maxDepth: 3 }, // shallow dirt
      { block: MUD, minDepth: 1, maxDepth: 4, strataHz: 4, strataAmp: 0.3 }, // mud lenses
      { block: DIRT, minDepth: 4 }, // deep dirt fallback
    ],
  },

  // ── Mountains ─────────────────────────────────────────────────────────────
  {
    baseHeight: TERRAIN_HEIGHT + 20,
    variance: 10,
    amplitude: 18,
    strata: [
      { block: GRAVEL, maxDepth: 0, strataHz: 6, strataAmp: 0.20 }, // loose surface gravel
      { block: DIORITE, maxDepth: 0, strataHz: 9, strataAmp: 0.15 }, // diorite outcrops
      { block: STONE, maxDepth: 6 }, // bulk upper rock
      { block: TUFF, minDepth: 2, maxDepth: 8, strataHz: 12, strataAmp: 0.40 }, // tuff bands
      { block: COBBLESTONE, minDepth: 4, maxDepth: 12, strataHz: 8, strataAmp: 0.30 }, // cobble seams
      { block: GRANITE, minDepth: 8, maxDepth: 20, strataHz: 6, strataAmp: 0.35 }, // granite intrusion
      { block: DEEPSLATE, minDepth: 16 }, // deep base
    ],
  },

  // ── Snow ──────────────────────────────────────────────────────────────────
  {
    baseHeight: TERRAIN_HEIGHT + 12,
    variance: 6,
    amplitude: 14,
    strata: [
      { block: SNOW, maxDepth: 0 }, // snow cap
      { block: STONE, minDepth: 1, maxDepth: 5 },
      { block: TUFF, minDepth: 3, maxDepth: 10, strataHz: 10, strataAmp: 0.35 },
      { block: DEEPSLATE, minDepth: 8 },
    ],
  },

  // ── Desert ────────────────────────────────────────────────────────────────
  {
    baseHeight: TERRAIN_HEIGHT - 4,
    variance: 3,
    amplitude: 8,
    strata: [
      { block: RED_SAND, maxDepth: 0, strataHz: 5, strataAmp: 0.40 }, // red sand patches
      { block: SAND, maxDepth: 2 }, // sand surface
      { block: RED_SAND, minDepth: 1, maxDepth: 5, strataHz: 7, strataAmp: 0.50 }, // red sand bands
      { block: SANDSTONE, minDepth: 3 }, // sandstone base
    ],
  },

  // ── Ocean ─────────────────────────────────────────────────────────────────
  {
    baseHeight: TERRAIN_HEIGHT - 16,
    variance: 2,
    amplitude: 3,
    strata: [
      { block: BLUE_GLASS, maxDepth: undefined }, // entire column
    ],
  },
];

// ── Hex math (pointy-top, axial coordinates) ───────────────────────────────────
const AXIAL_DIRS: [number, number][] = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]
];

function worldToAxial(wx: number, wz: number): [number, number] {
  const q = (Math.sqrt(3) / 3 * wx - wz / 3) / HEX_RADIUS;
  const r = (2 / 3 * wz) / HEX_RADIUS;
  return [q, r];
}

function axialToWorld(q: number, r: number): [number, number] {
  const wx = HEX_RADIUS * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
  const wz = HEX_RADIUS * (3 / 2 * r);
  return [wx, wz];
}

function hexRound(q: number, r: number): [number, number] {
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}

// ── Per-hex hashes ─────────────────────────────────────────────────────────────
function hexHash(a: number, b: number, salt: number): number {
  let h = (a * 0x9e3779b9 ^ b * 0x6c62272e ^ salt * 0x243f6a88 ^ NOISE_SEED) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h >>> 0) / 0x100000000;
}

function hexBiomeIndex(qi: number, ri: number): number {
  return Math.floor(hexHash(qi, ri, 1) * BIOMES.length);
}

// Height is hashed by biome type so all same-biome hexes share one height.
function hexSurfaceHeight(qi: number, ri: number): number {
  const biomeIndex = hexBiomeIndex(qi, ri);
  const biome = BIOMES[biomeIndex];
  const variation = (hexHash(biomeIndex, 0, 3) * 2 - 1) * biome.variance;
  return Math.round(biome.baseHeight + variation);
}

// ── Smoothstep ─────────────────────────────────────────────────────────────────
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ── Column classification ──────────────────────────────────────────────────────
//
// Returns the minimum perpendicular distance from (wx, wz) to any edge shared
// between two different biomes.  Same-biome edges are ignored entirely —
// this is what allows terrain noise to flow freely across shared-biome cells.
//
function minDistToDifferentBiomeEdge(
  wx: number, wz: number,
  qi: number, ri: number
): number {
  const biomeH = hexBiomeIndex(qi, ri);
  const [hx, hz] = axialToWorld(qi, ri);
  let minDist = Infinity;

  for (const [ddq, ddr] of AXIAL_DIRS) {
    const nqi = qi + ddq;
    const nri = ri + ddr;
    if (hexBiomeIndex(nqi, nri) === biomeH) continue; // same biome — no mask

    const [nx, nz] = axialToWorld(nqi, nri);
    const ex = nx - hx;
    const ez = nz - hz;
    const elen = Math.sqrt(ex * ex + ez * ez);
    const proj = ((wx - hx) * ex + (wz - hz) * ez) / elen;
    const dist = Math.abs(proj - elen / 2);
    if (dist < minDist) minDist = dist;
  }

  return minDist;
}

// ── Border check (unchanged logic, kept separate for clarity) ──────────────────
type BorderInfo = { isBorder: true; surfaceY: number } | { isBorder: false };

function classifyBorder(wx: number, wz: number, qi: number, ri: number): BorderInfo {
  const biomeH = hexBiomeIndex(qi, ri);
  const [hx, hz] = axialToWorld(qi, ri);
  let closestDist = Infinity;
  let closestBorderY = 0;

  for (const [ddq, ddr] of AXIAL_DIRS) {
    const nqi = qi + ddq;
    const nri = ri + ddr;
    if (hexBiomeIndex(nqi, nri) === biomeH) continue;

    const [nx, nz] = axialToWorld(nqi, nri);
    const ex = nx - hx;
    const ez = nz - hz;
    const elen = Math.sqrt(ex * ex + ez * ez);
    const proj = ((wx - hx) * ex + (wz - hz) * ez) / elen;
    const dist = Math.abs(proj - elen / 2);

    if (dist < BORDER_WIDTH && dist < closestDist) {
      closestDist = dist;
      const sideHeight = proj < elen / 2
        ? hexSurfaceHeight(qi, ri)
        : hexSurfaceHeight(nqi, nri);
      closestBorderY = sideHeight + BORDER_WIDTH;
    }
  }

  return closestDist < BORDER_WIDTH
    ? { isBorder: true, surfaceY: closestBorderY }
    : { isBorder: false };
}

// ── Block picker ───────────────────────────────────────────────────────────────
// strataHz/strataAmp create banding, but the sine is evaluated on a *warped*
// y value: wy + warp, where warp is a low-frequency noise sample in (wx, wz).
// This makes bands twist, pinch and bulge rather than sitting in flat sheets.
//
// STRATA_WARP controls how many voxels the bands can shift up/down.
// Higher = more dramatic warping. Keyed to world coords so it's chunk-independent.
const STRATA_WARP = 12;

function pickBlock(
  strata: StrataLayer[],
  depth: number,
  wy: number,
  warpNoise: number  // pre-sampled noise in [-1,1] at (wx, wz)
): Block {
  const warpedY = wy + warpNoise * STRATA_WARP;

  for (const layer of strata) {
    if (layer.minDepth !== undefined && depth < layer.minDepth) continue;
    if (layer.maxDepth !== undefined && depth > layer.maxDepth) continue;

    if (layer.strataHz !== undefined && layer.strataAmp !== undefined) {
      const s = (Math.sin(warpedY / TERRAIN_HEIGHT * Math.PI * layer.strataHz) + 1) / 2;
      if (s < 1 - layer.strataAmp) continue;
    }

    return layer.block;
  }
  return strata[strata.length - 1].block;
}

// ── Tree decorator ─────────────────────────────────────────────────────────────
const TREE_DENSITY = 0.008; // lower = more spread out
const TREE_SEARCH_PADDING = 10;    // must cover max branch reach + leaf radius
const PLAINS_BIOME_INDEX = 0;

type TreeBlock = { dx: number; dy: number; dz: number; block: Block };

// ── Seeded per-tree RNG ────────────────────────────────────────────────────────
// LCG seeded from the origin column — same tree every time, chunk-independent.
class TreeRNG {
  private s: number;
  constructor(wx: number, wz: number) {
    // Mix wx/wz into a 32-bit seed
    let h = (wx * 0x9e3779b9 ^ wz * 0x6c62272e ^ NOISE_SEED) >>> 0;
    h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
    h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
    this.s = (h ^ (h >>> 16)) >>> 0;
    this.f(); this.f(); this.f(); // warm up
  }
  f(): number { // float in [0,1)
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return this.s / 0x100000000;
  }
  int(lo: number, hi: number): number { return lo + Math.floor(this.f() * (hi - lo + 1)); }
}

// ── Leaf sphere helper ─────────────────────────────────────────────────────────
// Adds a roughly spherical (slightly vertically flattened) leaf cluster.
// Skips positions already occupied to avoid overwriting logs.
function leafCluster(
  out: Map<string, TreeBlock>,
  cx: number, cy: number, cz: number,
  radius: number
): void {
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++)
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx * dx + dy * dy * 1.5 + dz * dz > radius * radius + 0.5) continue;
        const key = `${cx + dx},${cy + dy},${cz + dz}`;
        if (!out.has(key))
          out.set(key, { dx: cx + dx, dy: cy + dy, dz: cz + dz, block: AZALEA_LEAVES });
      }
}

function log(out: Map<string, TreeBlock>, dx: number, dy: number, dz: number): void {
  out.set(`${dx},${dy},${dz}`, { dx, dy, dz, block: OAK_LOG });
}

// ── Procedural oak tree ────────────────────────────────────────────────────────
//
// Structure (matches the picture):
//   1. Straight trunk, height 7-10
//   2. 4-6 main branches fanning out from the upper half of the trunk.
//      Each branch: 4-6 log blocks stepping diagonally outward and slightly up.
//   3. Each branch terminates in a leaf cluster (radius 2-3).
//   4. A larger crown cluster (radius 3-4) caps the top of the trunk.
//
// Branch directions use the 8 horizontal diagonals so trees spread in all
// directions and look asymmetric from any angle.
//
const BRANCH_DIRS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]
];

function buildProceduralTree(wx: number, wz: number): TreeBlock[] {
  const rng = new TreeRNG(wx, wz);
  const out = new Map<string, TreeBlock>();

  const trunkH = rng.int(7, 10);
  const branchN = rng.int(4, 6);

  // ── Trunk ──
  for (let y = 0; y < trunkH; y++) log(out, 0, y, 0);

  // ── Crown cap ──
  leafCluster(out, 0, trunkH + 1, 0, rng.int(3, 4));

  // ── Branches ──
  // Shuffle directions so each tree gets a different subset
  const dirs = [...BRANCH_DIRS].sort(() => rng.f() - 0.5);

  for (let b = 0; b < branchN; b++) {
    const [ddx, ddz] = dirs[b % dirs.length];
    const startY = rng.int(Math.floor(trunkH * 0.55), trunkH - 1);
    const length = rng.int(4, 6);

    let bx = 0, by = startY, bz = 0;

    for (let i = 0; i < length; i++) {
      bx += ddx;
      bz += ddz;
      // Rise by 1 every 2 steps — shallow upward angle
      if (i % 2 === 0) by++;
      log(out, bx, by, bz);
    }

    // Leaf cluster at the tip
    leafCluster(out, bx, by + 1, bz, rng.int(2, 3));

    // Occasional mid-branch sub-cluster for a fuller canopy
    if (rng.f() < 0.5) {
      const mid = Math.floor(length / 2);
      leafCluster(out, Math.round(ddx * mid), startY + Math.floor(mid / 2), Math.round(ddz * mid), 2);
    }
  }

  return [...out.values()];
}

function columnHash(wx: number, wz: number, salt: number): number {
  let h = (wx * 0x9e3779b9 ^ wz * 0x6c62272e ^ salt * 0x85ebca6b ^ NOISE_SEED) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h >>> 0) / 0x100000000;
}

export class TerrainGenerator {
  private simplex = new Simplex2D(NOISE_SEED);
  private strataSimplex = new Simplex2D(NOISE_SEED ^ 0xdeadbeef);

  private fbm(wx: number, wz: number): number {
    let amp = 1, freq = NOISE_SCALE, val = 0, max = 0;
    for (let i = 0; i < NOISE_OCTAVES; i++) {
      val += this.simplex.noise(wx * freq, wz * freq) * amp;
      max += amp;
      amp *= NOISE_PERSISTENCE;
      freq *= NOISE_LACUNARITY;
    }
    return (val / max + 1) / 2;
  }

  // Surface classification extracted so both the terrain loop and the
  // cross-chunk decorator search can call it without duplication.
  private surfaceAt(wx: number, wz: number): { surfaceY: number; biomeIndex: number; isBorder: boolean } {
    const [q, r] = worldToAxial(wx, wz);
    const [qi, ri] = hexRound(q, r);
    const border = classifyBorder(wx, wz, qi, ri);

    if (border.isBorder)
      return { surfaceY: border.surfaceY, biomeIndex: -1, isBorder: true };

    const biomeIndex = hexBiomeIndex(qi, ri);
    const biome = BIOMES[biomeIndex];
    const base = hexSurfaceHeight(qi, ri);
    const fade = smoothstep(BORDER_WIDTH, BORDER_WIDTH + FADE_WIDTH,
      minDistToDifferentBiomeEdge(wx, wz, qi, ri));
    const surfaceY = base + Math.round(this.fbm(wx, wz) * biome.amplitude * fade);
    return { surfaceY, biomeIndex, isBorder: false };
  }

  // Decorator pass — runs after terrain fill.
  // Scans a padded region around the chunk for tree origins, places any
  // template blocks that land inside the chunk bounds.
  // Trees only replace AIR so they never overwrite terrain.
  private placeDecorators(
    blocks: Uint16Array,
    coffset: Vec3,
    chunkY0: number, chunkY1: number,
  ): void {
    const cx0 = coffset[0] * CHUNK_SIZE;
    const cz0 = coffset[2] * CHUNK_SIZE;

    for (let ox = cx0 - TREE_SEARCH_PADDING; ox < cx0 + CHUNK_SIZE + TREE_SEARCH_PADDING; ox++) {
      for (let oz = cz0 - TREE_SEARCH_PADDING; oz < cz0 + CHUNK_SIZE + TREE_SEARCH_PADDING; oz++) {

        // Hash decides whether a tree spawns at this world column
        if (columnHash(ox, oz, 10) > TREE_DENSITY) continue;

        const { surfaceY, biomeIndex, isBorder } = this.surfaceAt(ox, oz);
        if (isBorder || biomeIndex !== PLAINS_BIOME_INDEX) continue;

        const template = buildProceduralTree(ox, oz);

        for (const { dx, dy, dz, block } of template) {
          const wx = ox + dx;
          const wy = surfaceY + 1 + dy; // +1 so base sits on top of surface
          const wz = oz + dz;

          // Cull anything outside this chunk's x/z footprint
          const lx = wx - cx0;
          const lz = wz - cz0;
          if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;

          // Cull outside this chunk's y slab
          const ly = wy - chunkY0;
          if (ly < 0 || ly >= CHUNK_SIZE) continue;

          const index = Chunk.pack(lx, ly, lz);
          const existing = blocks[index];
          if (existing !== BlockStateRegistry.encode(AIR.ID, ORIENTATION.NX_0)) continue;

          blocks[index] = BlockStateRegistry.encode(block.ID, ORIENTATION.PX_0);
        }
      }
    }
  }

  generateBlocks(coffset: Vec3): { blocks: Uint16Array; heightmap: Uint8Array; amount: number } {
    const blocks = new Uint16Array(CHUNK_SIZE ** 3).fill(BlockStateRegistry.encode(AIR.ID, ORIENTATION.NX_0));
    const heightmap = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    let amount = 0;

    const chunkY0 = coffset[1] * CHUNK_SIZE;
    const chunkY1 = chunkY0 + CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = x + coffset[0] * CHUNK_SIZE;

      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wz = z + coffset[2] * CHUNK_SIZE;

        const { surfaceY, biomeIndex, isBorder } = this.surfaceAt(wx, wz);
        const biome = isBorder ? BIOMES[0] : BIOMES[biomeIndex];

        heightmap[x * CHUNK_SIZE + z] = Math.min(surfaceY, 255);

        const warpNoise = this.strataSimplex.noise(wx * 0.03, wz * 0.03);

        for (let y = 0; y < CHUNK_SIZE; y++) {
          const wy = y + chunkY0;
          if (wy > surfaceY) break;

          const depth = surfaceY - wy;
          const block = isBorder ? STONE : pickBlock(biome.strata, depth, wy, warpNoise);
          const index = Chunk.pack(x, y, z);
          blocks[index] = BlockStateRegistry.encode(block.ID, ORIENTATION.PX_0);
          amount++;
        }
      }
    }

    // Decorate after terrain so trees only overwrite air
    this.placeDecorators(blocks, coffset, chunkY0, chunkY1);

    // Recount after decoration
    const airCode = BlockStateRegistry.encode(AIR.ID, ORIENTATION.NX_0);
    amount = 0;
    for (let i = 0; i < blocks.length; i++)
      if (blocks[i] !== airCode) amount++;

    return { blocks, heightmap, amount };
  }
}
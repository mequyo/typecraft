import { vec3 } from "wgpu-matrix";

// PLAYER
export const MAX_HORIZONTAL_VELOCITY = 10.0;
export const PLAYER_BASE_SPEED = 2.0;
export const PLAYER_WIDTH = 0.6;
export const CAMERA_HEIGHT = 1.6;
export const PLAYER_HEIGHT = 1.8;
export const JUMP_FORCE = 10.0;
export const RENDER_DISTANCE = 6;
export const PLAYER_REACH = 5;

// WORLD
export const GROUND_FRICTION = 0.91;
export const GRAVITY = vec3.create(0, -30, 0);
export const AIR_CONTROL_FACTOR = 0.2;
export const CHUNK_SIZE = 32; // DO NOT CHANGE
export const TERRAIN_FLOOR = 16; // How many blocks are at least filled in
export const TERRAIN_HEIGHT = 64; // Can be wrong if multiple octaves are generated
export const MAX_CHUNKS_GENERATING_SIMULTANEOUSLY = 10;

// TEXTURES
export const ATLAS_WIDTH = 128;
export const ATLAS_HEIGHT = 128;
export const IMAGE_SIZE = 16;

// NOISE
export const NOISE_SCALE = 1 / 512; // Controls the zoom level of the base noise
export const NOISE_OCTAVES = 4; // Number of layers of noise to sum together for fractal detail
export const NOISE_PERSISTENCE = 0.5; // Controls how much amplitude decreases for each subsequent octave
export const NOISE_LACUNARITY = Math.E; // Controls how much the frequency increases per octave
export const NOISE_SEED = 0.7486437534857;
export const WORLEY_THRESHOLD = 0.25;

// USEFUL SIZES
export const FLOATS_PER_VERTEX = 3 + 2 + 1; // xyz + uv + t
export const BYTES_PER_VERTEX =
  Float32Array.BYTES_PER_ELEMENT * FLOATS_PER_VERTEX;
export const VERTICES_PER_FACE = FLOATS_PER_VERTEX * 6;

// MINIMAP
export const MINIMAP_UI_SIZE = 400;
export const MINIMAP_RENDER_SIZE = 2 * MINIMAP_UI_SIZE;
export const MINIMAP_MIN_ZOOM = 1;
export const MINIMAP_MAX_ZOOM = 256;
export const MINIMAP_INITIAL_ZOOM = 1; // pixels per block
export const MINIMAP_BLOCK_SIZE = 4;
export const MINIMAP_CANVAS_SIZE = 512;
export const REGION_SIZE = MINIMAP_CANVAS_SIZE / MINIMAP_BLOCK_SIZE;
export const REGION_WIDTH_IN_CHUNKS = MINIMAP_CANVAS_SIZE / CHUNK_SIZE / MINIMAP_BLOCK_SIZE;

// DYNAMIC BUFFER
export const BUFFER_GROW_FACTOR = 1.3; // How much padding the buffer has on resize
export const BUFFER_SHRINK_THRESHOLD = 0.7; // When to shrink the buffer
export const BUFFER_MIN_SIZE = 64;

// DATABASE
export const DATABASE_VERSION = 3;
export const AMOUNT_CHUNK_WORKERS = navigator.hardwareConcurrency - 3;

// SOUND
export const MINING_SOUND_INTERVAL = 200; // ms
export const PROFILER_ENABLED = true;

export const WORKGROUP_SIZE = vec3.create(4, 4, 4);

export const VERTEX_STRIDES: Record<GPUVertexFormat, number> = {
  "unorm10-10-10-2": 4,
  "unorm8x4-bgra": 4,

  uint8: 1,
  uint8x2: 2,
  uint8x4: 4,
  uint16: 2,
  uint16x2: 4,
  uint16x4: 8,
  uint32: 4,
  uint32x2: 8,
  uint32x3: 12,
  uint32x4: 16,

  sint8: 1,
  sint8x2: 2,
  sint8x4: 4,
  sint16: 2,
  sint16x2: 4,
  sint16x4: 8,
  sint32: 4,
  sint32x2: 8,
  sint32x3: 12,
  sint32x4: 16,

  unorm8: 1,
  unorm8x2: 2,
  unorm8x4: 4,
  unorm16: 2,
  unorm16x2: 4,
  unorm16x4: 8,
  snorm8: 1,
  snorm8x2: 2,
  snorm8x4: 4,
  snorm16: 2,
  snorm16x2: 4,
  snorm16x4: 8,

  float16: 2,
  float16x2: 4,
  float16x4: 8,
  float32: 4,
  float32x2: 8,
  float32x3: 12,
  float32x4: 16,
};

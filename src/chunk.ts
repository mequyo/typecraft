import { CHUNK_SIZE, IMAGE_SIZE } from "./constants";
import { FACE, ORIENTATION_FACE_MAP } from "./mesh";
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { AIR } from "./registries/blocks";
import { Vec3, vec3 } from "wgpu-matrix";
import { Allocation, ArenaBuffer } from "./classes/arena-buffer";
import { BlockRegistry } from "./registries/block-registry";
import { Sixtuple } from "./types";
import { createMeshes } from "./mesh-utils";


// Reusable arrays for mesh generation
const MESH_BUFFERS: Sixtuple<Uint32Array> = [
  new Uint32Array((CHUNK_SIZE ** 3) * 6 * 2), // Currently using 2 ints per vertex
  new Uint32Array((CHUNK_SIZE ** 3) * 6 * 2),
  new Uint32Array((CHUNK_SIZE ** 3) * 6 * 2),
  new Uint32Array((CHUNK_SIZE ** 3) * 6 * 2),
  new Uint32Array((CHUNK_SIZE ** 3) * 6 * 2),
  new Uint32Array((CHUNK_SIZE ** 3) * 6 * 2),
];


export class Chunk {
  public blocks: Uint16Array = new Uint16Array(CHUNK_SIZE ** 3)   // Flat Array containing all the blockstates of this chunk
  public dirty: boolean = false                                   // Whether the mesh needs to be rebuilt
  public offset: Vec3                                             // Chunk position in world
  public timestamp: number                                        // Timestamp of when this chunk was created
  public blockamount: number                                      // The amount of blocks in this chunk
  public AABB: { min: Vec3, max: Vec3 }                           // World min and max bounds
  public center: Vec3
  public canvas: OffscreenCanvas                                  // Canvas to draw to
  public context: OffscreenCanvasRenderingContext2D               // Context to draw bitmap to
  public allocations: Sixtuple<Allocation>                        // Allocated space in ArenaBuffer
  static chunkBuffer: ArenaBuffer


  constructor(offset: Vec3, timestamp: number, blockamount: number, allocations: [Allocation, Allocation, Allocation, Allocation, Allocation, Allocation], blocks: Uint16Array) {
    this.offset = vec3.copy(offset);
    this.timestamp = timestamp;
    this.blockamount = blockamount;
    this.blocks = blocks;
    this.allocations = allocations;

    // Bitmap
    this.canvas = new OffscreenCanvas(CHUNK_SIZE, CHUNK_SIZE);
    this.context = this.canvas.getContext("2d")!;
    this.drawTopView();

    // AABB
    const min = vec3.create(this.offset[0] * CHUNK_SIZE, this.offset[1] * CHUNK_SIZE, this.offset[2] * CHUNK_SIZE);
    const max = vec3.create(min[0] + CHUNK_SIZE, min[1] + CHUNK_SIZE, min[2] + CHUNK_SIZE);
    this.AABB = { min, max };
    this.center = vec3.create(CHUNK_SIZE * (offset[0] + 0.5), CHUNK_SIZE * (offset[1] + 0.5), CHUNK_SIZE * (offset[2] + 0.5));
  }


  private drawTopView() {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let y = CHUNK_SIZE - 1; y >= 0; y--) {
          const index = Chunk.pack(x, y, z);

          const blockstate = this.blocks[index];
          const { block: ID, orientation } = BlockStateRegistry.decode(blockstate);

          if (ID == AIR.ID) continue;

          const block = BlockRegistry.get(ID);
          const texture = block.textures[ORIENTATION_FACE_MAP[orientation][FACE.PY] % block.textures.length];

          this.context.drawImage(texture.bitmap!, x, z, 1, 1);

          break;
        }
      }
    }
  }


  /**
   * This method takes in a local coordinate and returns a bitpacked index where each coordinate gets 5 bits. Therefore, each coordinate must be 
   * between [0, 31].
   * @param x The x coordinate.
   * @param y The y coordinate.
   * @param z The z coordinate.
   * @returns A number representing the coordinate.
   */
  static pack(x: number, y: number, z: number) {
    return (x & 31) << 10 | (y & 31) << 5 | (z & 31);
  }


  /**
   * Takes in a bitpacked key and returns the corresponding x, y and z coordinate. To avoid garbage collector pressure, this method 
   * writes the output into a given array.
   * @param out The array to write the coordinate into.
   * @param key The bitpacked key representing the coordinate.
   */
  static unpack(out: Vec3, key: number) {
    out[0] = (key >>> 10) & 31;
    out[1] = (key >>> 5) & 31;
    out[2] = key & 31;
  }


  /**
   * Returns the block at the given coordinate. X, y and z should be within [0, 31]. This method idoes not raise errors.
   * @param x The x coordinate.
   * @param y The y coordinate.
   * @param z The z coordinate.
   * @returns The block at the given position.
   */
  get(x: number, y: number, z: number): number {
    return this.blocks[Chunk.pack(x, y, z)];
  }


  /**
   * Sets a blockstate at the given coordinate, updates the bitmap (for the minimap) and updates the mesh efficiently.
   * @param x The x coordinate.
   * @param y The y coordinate.
   * @param z The z coordinate.
   * @param blockstate The blockstate to write. Can be AIR to delete blocks.
   */
  set(x: number, y: number, z: number, blockstate: number, neighbors: Sixtuple<Uint16Array | undefined>) {
    const index = Chunk.pack(x, y, z);
    const oldstate = this.blocks[index];
    const curblockID = BlockStateRegistry.decode(oldstate).block;
    const newblockID = BlockStateRegistry.decode(blockstate).block;

    // TODO Air should only be one state to avoid this check
    if (blockstate == oldstate || (curblockID == AIR.ID && newblockID == AIR.ID)) return; // Nothing changed

    if (curblockID == AIR.ID && newblockID != AIR.ID) this.blockamount++;
    else if (curblockID != AIR.ID && newblockID == AIR.ID) this.blockamount--;

    this.blocks[index] = blockstate;
    this.dirty = true; // TODO update mesh immediately and efficiently to avoid needing a dirty flag

    // Check if the new block is the highest block in this column and draw into bitmap if that's the case
    for (let i = CHUNK_SIZE - 1; i >= 0; i--) {
      const state = this.get(x, i, z);
      const { block: ID, orientation } = BlockStateRegistry.decode(state);

      if (ID == AIR.ID) continue; // Current highest block is higher than y
      if (i > y) break; // Found block, but it's higher than y

      // Fetch top texture and draw into bitmap
      const block = BlockRegistry.get(ID);
      const texture = block.textures[ORIENTATION_FACE_MAP[orientation][FACE.PY] % block.textures.length];

      this.context.drawImage(texture.bitmap!, x * IMAGE_SIZE, z * IMAGE_SIZE);
    }

    // TEST update mesh
    const meshes = createMeshes(MESH_BUFFERS, this.blocks, neighbors);

    for (let i = 0; i < this.allocations.length; i++) {
      Chunk.chunkBuffer.free(this.allocations[i]);
      this.allocations[i] = Chunk.chunkBuffer.write(i, meshes[i]);
    }
  }
}
import { vec3 } from "wgpu-matrix";
import { Chunk } from "./chunk";
import {
  CHUNK_SIZE,
  MINIMAP_BLOCK_SIZE,
  MINIMAP_CANVAS_SIZE,
  REGION_SIZE,
} from "./constants";
import { FACE, ORIENTATION, ORIENTATION_FACE_MAP } from "./mesh";
import { Registry, RegistryData } from "./registry";
import { BlockStateData, BlockStateHash } from "./blockstate";

export class Region {
  public rx: number;
  public rz: number;
  public wx: number;
  public wz: number;
  public canvas = new OffscreenCanvas(MINIMAP_CANVAS_SIZE, MINIMAP_CANVAS_SIZE);
  private context = this.canvas.getContext("2d")!;
  private heightmap = new Int16Array(REGION_SIZE * REGION_SIZE).fill(-32768);

  public constructor(rkey: number) {
    const rxrz: [number, number] = [0, 0];
    Region.unpack(rkey, rxrz);
    const rx = rxrz[0],
      rz = rxrz[1];
    this.rx = rx;
    this.rz = rz;
    this.wx = rx * REGION_SIZE;
    this.wz = rz * REGION_SIZE;
  }

  public updateBlock(
    wx: number,
    wy: number,
    wz: number,
    blockhash: number,
    reg: RegistryData<BlockStateData>,
  ) {
    if (
      wx < this.wx ||
      wx >= this.wx + REGION_SIZE ||
      wz < this.wz ||
      wz >= this.wz + REGION_SIZE
    )
      return;

    const lx = wx - this.wx;
    const lz = wz - this.wz;
    const index = lz * REGION_SIZE + lx;

    if (this.heightmap[index] > wy) return;

    const blockstate = Registry.get(reg, "ID", blockhash);
    const block = blockstate.block;
    const orientation = blockstate.properties.orientation as ORIENTATION;

    // TODO fix this, for now assume air
    if (orientation == undefined) return;

    const texture =
      block.textures[
        ORIENTATION_FACE_MAP[orientation][FACE.PY] % block.textures.length
      ];

    this.context.drawImage(
      texture.bitmap!,
      lx * MINIMAP_BLOCK_SIZE,
      lz * MINIMAP_BLOCK_SIZE,
      MINIMAP_BLOCK_SIZE,
      MINIMAP_BLOCK_SIZE,
    );
    this.heightmap[index] = wy;
  }

  public updateChunk(chunk: Chunk, reg: RegistryData<BlockStateData>) {
    const offset = vec3.mulScalar(chunk.offset, CHUNK_SIZE);

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let y = CHUNK_SIZE - 1; y >= 0; y--) {
          const index = Chunk.pack(x, y, z);
          const hash = chunk.blocks[index];
          const blockstate = Registry.get(reg, "ID", hash);
          const block = blockstate.block;

          if (block.ID == 0) continue;

          const wx = x + offset[0];
          const wy = y + offset[1];
          const wz = z + offset[2];
          this.updateBlock(wx, wy, wz, chunk.blocks[index], reg);
        }
      }
    }
  }

  public static pack(wx: number, wz: number) {
    const rx = Math.floor(wx / REGION_SIZE);
    const rz = Math.floor(wz / REGION_SIZE);

    return ((rx + 32768) << 16) | ((rz + 32768) << 0);
  }

  public static unpack(key: number, out: [number, number]) {
    out[0] = ((key >>> 16) & 0xffff) - 32768;
    out[1] = ((key >>> 0) & 0xffff) - 32768;
  }
}

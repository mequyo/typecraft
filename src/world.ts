import { Camera } from "./camera";
import { Chunk } from "./chunk";
import {
  CHUNK_SIZE,
  AMOUNT_CHUNK_WORKERS,
  RENDER_DISTANCE,
  MINING_SOUND_INTERVAL,
  MAX_PENDING_REQUESTS,
} from "./constants";
import { TerrainGenerator } from "./terrain-generator";
import { ChunkMessage, Ray, Sixtuple, WorkerMessageOut } from "./types";
import { Pair } from "./classes/pair";
import { Mat4, mat4, Vec2, vec2, Vec3, vec3 } from "wgpu-matrix";
import { State } from "./state";
import { FACE_NORMALS, MESHES } from "./mesh";
import { vec3ToLocalChunk } from "./lib";
import { BlockRegistry } from "./registries/block-registry";
import { SoundRegistry } from "./registries/sound-registry";
import { Allocation } from "./classes/arena-buffer";
import { SlotMap } from "./classes/slot-map";
import { Player } from "./player";
import { Region } from "./region";
import { PlayerSystem } from "./player-system";
import { Rand } from "./classes/random";
import { RegistryManagerData } from "./registry-manager";
import { BlockState, BlockStateHash } from "./blockstate";
import { Registry } from "./registry";
import { useStore } from "./store";

// TODO delete chunks that are too far away

type DamagedBlock = {
  damage: number;
  hardness: number;
  position: Vec3;
  lastHitTime: number;
  lastSoundTime: number;
  nextSoundAt: number;
};

export class World {
  public chunks = new SlotMap<number, Chunk>();
  public regions = new SlotMap<number, Region>();
  public heightmap: Pair<number, number>; // [x, z] => height
  public blockmap: Pair<number, number>; // [x, z] => blockID
  public workers: Worker[] = [];
  public worker: number;
  public pending = new Set<number>();
  public rendered: number;
  public seconds: number;
  public chunkHeightmap: Pair<number, Chunk>;
  public terraingenerator: TerrainGenerator;
  public queue = new Map<number, WorkerMessageOut>();
  public pendingOrder: number[] = [];
  public damaged: Map<number, DamagedBlock>;
  public filtered: Chunk[] = [];
  private vp: Mat4 = mat4.create();
  private planes = new Float32Array(24);
  public manager: RegistryManagerData;

  constructor(
    terraingenerator: TerrainGenerator,
    manager: RegistryManagerData,
  ) {
    this.manager = manager;
    this.terraingenerator = terraingenerator;
    this.seconds = 0;
    this.rendered = 0;
    this.heightmap = new Pair();
    this.chunkHeightmap = new Pair();
    this.blockmap = new Pair();
    this.worker = 0;
    this.damaged = new Map();

    for (let i = 0; i < AMOUNT_CHUNK_WORKERS; i++) {
      const worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
      this.workers.push(worker);
    }
  }

  damageBlock(wx: number, wy: number, wz: number, dt: number, player: Player) {
    const now = performance.now();
    const key = World.pack(wx, wy, wz);
    const position = vec3.create(wx, wy, wz);
    const hash = this.getBlockState(position);
    const blockstate = Registry.get(this.manager.blockstates, "ID", hash);
    const block = blockstate.block;

    let entry = this.damaged.get(key);

    // Block hasn't been damaged before
    if (!entry) {
      entry = {
        damage: 0,
        position,
        hardness: block.hardness,
        lastHitTime: now,
        nextSoundAt: 0,
        lastSoundTime: 0,
      };
      this.damaged.set(key, entry);
    }

    entry.damage += dt;

    // Check whether sound can be played
    if (now - entry.lastSoundTime > MINING_SOUND_INTERVAL) {
      entry.lastSoundTime = now;
      // TODO safety guard for possibly no mining sounds
      // TODO play sound
    }

    // Destroy block
    if (entry.damage >= entry.hardness) {
      const blockID = blockstate.block.ID;

      PlayerSystem.addToInventory(player, blockID, 1);

      useStore.setState({
        hotbar: player.hotbar,
        hand: player.hand,
        inventory: player.inventory,
      });

      this.addBlock(position, 0 as BlockStateHash); // AIR blockstate
      this.damaged.delete(key);
      // Play destroy sound
    }
  }

  public raycast(
    ray: Ray,
    distance: number,
  ): { pos: Vec3; face: Vec3; uv: Vec2 } | null {
    const { origin: start, direction: dir } = ray;
    let x = Math.floor(start[0]);
    let y = Math.floor(start[1]);
    let z = Math.floor(start[2]);

    const sx = Math.sign(dir[0]);
    const sy = Math.sign(dir[1]);
    const sz = Math.sign(dir[2]);

    const dx = Math.abs(1 / dir[0]);
    const dy = Math.abs(1 / dir[1]);
    const dz = Math.abs(1 / dir[2]);

    let mx = (sx > 0 ? x + 1 - start[0] : start[0] - x) * dx;
    let my = (sy > 0 ? y + 1 - start[1] : start[1] - y) * dy;
    let mz = (sz > 0 ? z + 1 - start[2] : start[2] - z) * dz;

    let t = 0;

    while (t < distance) {
      const blockstateID = this.getBlockState(vec3.create(x, y, z));
      const blockstate = Registry.get(
        this.manager.blockstates,
        "ID",
        blockstateID,
      );
      const block = blockstate.block;
      if (block && block.ID !== 0) {
        const meshID = block.meshID;
        const mesh = MESHES[meshID];
        const orientation = blockstate.properties.orientation as number;
        const hit = mesh.intersectRay(ray, vec3.create(x, y, z), orientation);

        // REMOVED "&& hit.distance >= t" to avoid floating point precision misses
        if (hit && hit.distance <= distance) {
          return {
            pos: vec3.create(x, y, z),
            face: hit.normal,
            uv: hit.uv,
          };
        }
      }

      // Advance to next cell
      if (mx < my) {
        if (mx < mz) {
          t = mx;
          mx += dx;
          x += sx;
        } else {
          t = mz;
          mz += dz;
          z += sz;
        }
      } else {
        if (my < mz) {
          t = my;
          my += dy;
          y += sy;
        } else {
          t = mz;
          mz += dz;
          z += sz;
        }
      }
    }

    return null;
  }

  // -512 to 512 on each axis
  static pack(cx: number, cy: number, cz: number): number {
    return ((cx + 512) << 20) | ((cy + 512) << 10) | ((cz + 512) << 0);
  }

  // For local indirection indexing (in your state setup)
  static packIndirection(
    cx: number,
    cy: number,
    cz: number,
    renderDistance: number,
  ): number {
    const gridSize = 2 * renderDistance + 1;
    const half = gridSize >> 1;
    const lx = cx + half;
    const ly = cy + half;
    const lz = cz + half;

    // Validate bounds
    if (lx < 0 || ly < 0 || lz < 0) return 0xffffffff;
    if (lx >= gridSize || ly >= gridSize || lz >= gridSize) return 0xffffffff;

    return lx * gridSize * gridSize + ly * gridSize + lz;
  }

  static unpack(key: number, out: [number, number, number]) {
    out[0] = ((key >>> 20) & 1023) - 512;
    out[1] = ((key >>> 10) & 1023) - 512;
    out[2] = ((key >>> 0) & 1023) - 512;
  }

  // Queues chunks around the player
  queueChunks(player: Player, state: State) {
    const playerChunkPos = vec3.floor(
      vec3.divScalar(player.position, CHUNK_SIZE),
    );
    const chunkpos = vec3.create();
    for (let i = 0; i < state.sphere_offsets.length; i += 1) {
      vec3.add(playerChunkPos, state.sphere_offsets[i], chunkpos);

      this.queueChunk(chunkpos);
    }

    this.generateChunk(state.time.seconds, state);

    // TODO Dequeue chunks that are too far away
  }

  queueChunk(offset: Vec3) {
    if (this.pending.size >= MAX_PENDING_REQUESTS) return;

    const worker = this.workers[this.worker];
    const key = World.pack(offset[0], offset[1], offset[2]);

    if (this.pending.has(key) || this.chunks.get(key) != undefined) return; // Already generating or generated

    const message = (e: MessageEvent<WorkerMessageOut>) => {
      this.queue.set(e.data.key, e.data);

      worker.removeEventListener("message", message);
    };

    const neighbors: Sixtuple<Uint16Array | undefined> = [
      this.getChunk(vec3.add(offset, FACE_NORMALS[0]))?.blocks,
      this.getChunk(vec3.add(offset, FACE_NORMALS[1]))?.blocks,
      this.getChunk(vec3.add(offset, FACE_NORMALS[2]))?.blocks,
      this.getChunk(vec3.add(offset, FACE_NORMALS[3]))?.blocks,
      this.getChunk(vec3.add(offset, FACE_NORMALS[4]))?.blocks,
      this.getChunk(vec3.add(offset, FACE_NORMALS[5]))?.blocks,
    ];

    const elements = CHUNK_SIZE ** 3;
    const packedNeighbors = new Uint16Array(elements * 6);
    for (let i = 0; i < 6; i++) {
      const n = neighbors[i];
      if (n !== undefined) packedNeighbors.set(n, i * elements);
    }

    worker.addEventListener("message", message);

    worker.postMessage({
      type: "chunk",
      offset,
      neighborsBuffer: packedNeighbors.buffer,
    } as ChunkMessage, [packedNeighbors.buffer]);

    this.pending.add(key);
    this.pendingOrder.push(key);
    this.worker = (this.worker + 1) % this.workers.length;
  }

  generateChunk(time: number, state: State) {
    while (this.pendingOrder.length > 0) {
      const key = this.pendingOrder[0];
      const data = this.queue.get(key);
      if (!data) break;

      this.pendingOrder.shift();
      this.queue.delete(key);

      const start = performance.now();

      const offset = new Float32Array(data.offset);
      const blocks = new Uint16Array(data.blocks);
      //const heightmap = new Uint8Array(data.heightmap);
      const amount = new Uint16Array(data.amount)[0] ?? 0;
      const meshes = data.meshes.map(
        (arraybuffer) => new Uint32Array(arraybuffer),
      );

      const allocations: Sixtuple<Allocation> = [
        state.chunkBuffer.write(0, meshes[0]),
        state.chunkBuffer.write(1, meshes[1]),
        state.chunkBuffer.write(2, meshes[2]),
        state.chunkBuffer.write(3, meshes[3]),
        state.chunkBuffer.write(4, meshes[4]),
        state.chunkBuffer.write(5, meshes[5]),
      ];

      const chunk = new Chunk(
        offset,
        time,
        amount,
        allocations,
        blocks,
        state.registrymanager,
      );

      this.chunks.set(key, chunk);
      this.pending.delete(key);

      const rkey = Region.pack(offset[0] * CHUNK_SIZE, offset[2] * CHUNK_SIZE);
      const region = this.regions.getOrSet(rkey, () => new Region(rkey));

      region.updateChunk(chunk, this.manager.blockstates);

      state.profiler.add("chunk generation", performance.now() - start);
    }
  }

  getChunk(offset: Vec3): Chunk | undefined {
    return this.chunks.get(World.pack(offset[0], offset[1], offset[2]));
  }

  addBlock(worldpos: Vec3, block: number): boolean {
    const chunk = this.getChunk(
      vec3.floor(vec3.divScalar(worldpos, CHUNK_SIZE)),
    );

    if (!chunk) return false;

    const chunkpos = vec3ToLocalChunk(worldpos); // worldpos.mod(CHUNK_SIZE).add(CHUNK_SIZE).mod(CHUNK_SIZE);
    const neighbors: Sixtuple<Uint16Array | undefined> = [
      this.getChunk(vec3.add(chunkpos, FACE_NORMALS[0]))?.blocks,
      this.getChunk(vec3.add(chunkpos, FACE_NORMALS[1]))?.blocks,
      this.getChunk(vec3.add(chunkpos, FACE_NORMALS[2]))?.blocks,
      this.getChunk(vec3.add(chunkpos, FACE_NORMALS[3]))?.blocks,
      this.getChunk(vec3.add(chunkpos, FACE_NORMALS[4]))?.blocks,
      this.getChunk(vec3.add(chunkpos, FACE_NORMALS[5]))?.blocks,
    ];

    chunk.set(chunkpos[0], chunkpos[1], chunkpos[2], block, neighbors);
    return true;
  }

  getBlockState(position: Vec3): BlockStateHash {
    const chunk = this.getChunk(
      vec3.floor(vec3.divScalar(position, CHUNK_SIZE)),
    );

    if (!chunk) return 0 as BlockStateHash; // AIR

    const cpos = vec3ToLocalChunk(position);

    return chunk.get(cpos[0], cpos[1], cpos[2]);
  }

  deleteChunk(offset: Vec3): boolean {
    return this.chunks.delete(World.pack(offset[0], offset[1], offset[2]));
  }

  filterChunks(camera: Camera) {
    this.filtered.length = 0;
    mat4.multiply(camera.projection, camera.view(), this.vp); // Update view projection

    // Extract frustum planes
    const vp = this.vp;
    const planes = this.planes;
    planes[0] = vp[3] + vp[0];
    planes[1] = vp[7] + vp[4];
    planes[2] = vp[11] + vp[8];
    planes[3] = vp[15] + vp[12]; // Left
    planes[4] = vp[3] - vp[0];
    planes[5] = vp[7] - vp[4];
    planes[6] = vp[11] - vp[8];
    planes[7] = vp[15] - vp[12]; // Right
    planes[8] = vp[3] + vp[1];
    planes[9] = vp[7] + vp[5];
    planes[10] = vp[11] + vp[9];
    planes[11] = vp[15] + vp[13]; // Bottom
    planes[12] = vp[3] - vp[1];
    planes[13] = vp[7] - vp[5];
    planes[14] = vp[11] - vp[9];
    planes[15] = vp[15] - vp[13]; // Top
    planes[16] = vp[3] + vp[2];
    planes[17] = vp[7] + vp[6];
    planes[18] = vp[11] + vp[10];
    planes[19] = vp[15] + vp[14]; // Near
    planes[20] = vp[3] - vp[2];
    planes[21] = vp[7] - vp[6];
    planes[22] = vp[11] - vp[10];
    planes[23] = vp[15] - vp[14]; // Far

    // Check each chunk against the frustum
    const CHUNK_HALF_DIAGONAL = (Math.sqrt(3) * CHUNK_SIZE) / 2;
    const chunks = this.chunks;
    const renderdistance = (RENDER_DISTANCE * CHUNK_SIZE) ** 2;
    const close = (3 * CHUNK_SIZE) ** 2;

    for (let i = 0; i < chunks.size; i++) {
      const chunk = chunks.values[i];
      chunk.visible = false;

      if (chunk.blockamount == 0) continue;

      const aabb = chunk.AABB;
      const min = aabb.min;
      const max = aabb.max;

      // Check whether chunk is behind the player
      const cx = chunk.center[0] - camera.position[0];
      const cy = chunk.center[1] - camera.position[1];
      const cz = chunk.center[2] - camera.position[2];
      const dot =
        cx * camera.direction[0] +
        cy * camera.direction[1] +
        cz * camera.direction[2];

      if (dot < -CHUNK_HALF_DIAGONAL) continue; // Chunk is behind camera

      // Check whether chunk is within render distance or very close
      const dx = min[0] - camera.position[0];
      const dy = min[1] - camera.position[1];
      const dz = min[2] - camera.position[2];
      const distance = dx * dx + dy * dy + dz * dz; // squared

      if (distance > renderdistance) continue;
      if (distance < close) {
        this.filtered.push(chunk);
        chunk.visible = true;
        continue;
      }

      // Find the corner most inside the frustum. To check if the WHOLE box is outside, we test the "positive" vertex
      let outside = false;
      for (let p = 0; p < 24; p += 4) {
        const a = planes[p + 0];
        const b = planes[p + 1];
        const c = planes[p + 2];
        const d = planes[p + 3];
        const x = a >= 0 ? max[0] : min[0];
        const y = b >= 0 ? max[1] : min[1];
        const z = c >= 0 ? max[2] : min[2];

        if (a * x + b * y + c * z + d < 0) {
          outside = true;
          break;
        }
      }

      if (!outside) {
        this.filtered.push(chunk);
        chunk.visible = true;
      }
    }

    this.rendered = this.filtered.length;
  }
}

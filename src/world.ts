import { Camera } from "./camera";
import { Chunk } from "./chunk";
import { CHUNK_SIZE, AMOUNT_CHUNK_WORKERS, RENDER_DISTANCE, MINING_SOUND_INTERVAL } from "./constants";
import { TerrainGenerator } from "./terrain-generator";
import { WorkerMessageIn, WorkerMessageOut } from "./types";
import { Pair } from "./classes/pair";
import { mat4, Vec3, vec3 } from "wgpu-matrix";
import { State } from "./state";
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { AIR } from "./registries/blocks";
import { ORIENTATION, SPHERE_OFFSETS } from "./mesh";
import { vec3ToLocalChunk } from "./lib";
import { BlockRegistry } from "./registries/block-registry";
import { SoundRegistry } from "./registries/sound-registry";
import { Allocation } from "./classes/arena-buffer";
import { SlotMap } from "./classes/slot-map";
import { Player } from "./player";



// TODO delete chunks that are too far away

type DamagedBlock = {
  damage: number
  hardness: number
  position: Vec3
  lastHitTime: number
  lastSoundTime: number
  nextSoundAt: number
}



export class World {
  //public chunks = new Map<number, Chunk>()
  public chunks = new SlotMap<number, Chunk>();
  public heightmap: Pair<number, number> // [x, z] => height
  public blockmap: Pair<number, number> // [x, z] => blockID
  public workers: Worker[] = []
  public worker: number
  public pending = new Set<number>()
  public rendered: number
  public seconds: number
  public chunkHeightmap: Pair<number, Chunk>
  public terraingenerator: TerrainGenerator
  public queue: WorkerMessageOut[] = []
  public damaged: Map<number, DamagedBlock>



  constructor(terraingenerator: TerrainGenerator) {
    this.terraingenerator = terraingenerator;
    this.seconds = 0;
    this.rendered = 0;
    this.heightmap = new Pair();
    this.chunkHeightmap = new Pair();
    this.blockmap = new Pair();
    this.worker = 0;
    this.damaged = new Map();

    for (let i = 0; i < AMOUNT_CHUNK_WORKERS; i++) {
      const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      this.workers.push(worker);
    }
  }



  damageBlock(wx: number, wy: number, wz: number, dt: number) {
    const now = performance.now();
    const key = this.pack(vec3.create(wx, wy, wz));
    const blockstate = this.getBlockState(vec3.create(wx, wy, wz));
    const blockID = BlockStateRegistry.decode(blockstate).block;
    const block = BlockRegistry.get(blockID);

    let entry = this.damaged.get(key);

    // Block hasn't been damaged before
    if (!entry) {
      entry = {
        damage: 0,
        position: vec3.create(wx, wy, wz),
        hardness: block.hardness,
        lastHitTime: now,
        nextSoundAt: 0,
        lastSoundTime: 0
      };
      this.damaged.set(key, entry);
    }

    entry.damage += dt;

    // Check whether sound can be played
    if (now - entry.lastSoundTime > MINING_SOUND_INTERVAL) {
      entry.lastSoundTime = now;
      SoundRegistry.play(block.sounds.mining.random()!.ID, 1.0);
    }

    // Destroy block
    if (entry.damage >= entry.hardness) {
      this.addBlock(vec3.create(wx, wy, wz), BlockStateRegistry.encode(AIR.ID, ORIENTATION.NX_0));
      this.damaged.delete(key);
      SoundRegistry.play(block.sounds.dig.random()!.ID, 1.0);
    }
  }



  // -512 to 512 on each axis
  pack(o: Vec3): number {
    return ((o[0] + 512) << 20) | ((o[1] + 512) << 10) | (o[2] + 512);
  }



  unpack(key: number, out: [number, number, number]) {
    out[0] = ((key >>> 20) & 1023) - 512;
    out[1] = ((key >>> 10) & 1023) - 512;
    out[2] = (key & 1023) - 512;
  }


  // Queues chunks around the player
  queueChunks(player: Player, state: State) {
    const playerChunkPos = vec3.floor(vec3.divScalar(player.position, CHUNK_SIZE));

    for (let i = 0; i < SPHERE_OFFSETS.length; i += 1) {
      const chunkpos = vec3.add(playerChunkPos, SPHERE_OFFSETS[i]);

      this.queueChunk(state.device, chunkpos, state.time.seconds, state.minimap.zoom, state);
    }

    this.generateChunk(state.device, state.time.seconds, state);

    // TODO Dequeue chunks that are too far away
  }


  queueChunk(device: GPUDevice, offset: Vec3, time: number, zoom: number, state: State) {
    const MAX_PENDING_REQUESTS = 12;

    if (this.pending.size >= MAX_PENDING_REQUESTS) return;

    const worker = this.workers[this.worker];
    const key = this.pack(offset);

    if (this.pending.has(key) || this.chunks.get(key) != undefined) return; // Already generating or generated

    const message = (e: MessageEvent<WorkerMessageOut>) => {
      this.queue.push(e.data);

      worker.removeEventListener("message", message);
    };

    worker.addEventListener("message", message);
    worker.postMessage({ offset } as WorkerMessageIn);

    this.pending.add(key);
    this.worker = (this.worker + 1) % this.workers.length;
  }

  generateChunk(device: GPUDevice, time: number, state: State) {
    const data = this.queue.pop();

    if (!data) return;

    const start = performance.now();

    const offset = new Float32Array(data.offset);
    const key = this.pack(offset);
    const blocks = new Uint16Array(data.blocks);
    const heightmap = new Uint8Array(data.heightmap);
    const amount = new Uint16Array(data.amount)[0] ?? 0;
    const meshes = data.meshes.map(arraybuffer => new Uint32Array(arraybuffer));


    //generateBlocksCompute(device, CHUNK_SIZE, this, offset);

    //const alloc = state.chunkBuffer.write(mesh);

    const allocations: [Allocation, Allocation, Allocation, Allocation, Allocation, Allocation] = [
      state.chunkBuffer.write(0, meshes[0]),
      state.chunkBuffer.write(1, meshes[1]),
      state.chunkBuffer.write(2, meshes[2]),
      state.chunkBuffer.write(3, meshes[3]),
      state.chunkBuffer.write(4, meshes[4]),
      state.chunkBuffer.write(5, meshes[5]),
    ]

    //console.log(`mesh: ${mesh.byteLength.toLocaleString()}, allocations: ${allocations.map(all => all.size).reduce((prev, curr) => prev + curr, 0).toLocaleString()}`)

    const chunk = new Chunk(offset, time, amount, allocations, blocks);

    this.chunks.set(key, chunk);
    this.pending.delete(key);

    state.performance.chunk_generation.push(performance.now() - start)
  }


  getChunk(offset: Vec3): Chunk | undefined {
    return this.chunks.get(this.pack(offset));
  }

  addBlock(worldpos: Vec3, block: number): boolean {
    const chunk = this.getChunk(vec3.floor(vec3.divScalar(worldpos, CHUNK_SIZE)));

    if (!chunk) return false;

    const chunkpos = vec3ToLocalChunk(worldpos);// worldpos.mod(CHUNK_SIZE).add(CHUNK_SIZE).mod(CHUNK_SIZE);

    chunk.set(chunkpos[0], chunkpos[1], chunkpos[2], block);
    return true;
  }

  getBlockState(position: Vec3): number {
    const chunk = this.getChunk(vec3.floor(vec3.divScalar(position, CHUNK_SIZE)));

    if (!chunk) return BlockStateRegistry.encode(AIR.ID, ORIENTATION.NX_0);

    const cpos = vec3ToLocalChunk(position);

    return chunk.get(cpos[0], cpos[1], cpos[2]);
  }

  deleteChunk(offset: Vec3): boolean {
    //const chunk = this.chunks[this.key(offset)];
    //delete this.chunks[this.key(offset)];
    //return chunk != null;
    return this.chunks.delete(this.pack(offset));
  }

  getFilteredChunks(camera: Camera): Chunk[] { // TODO actually frustum cull
    const filtered: Chunk[] = [];
    const vp = mat4.multiply(camera.projection, camera.view);

    // Extract frustum planes
    const planes: number[][] = [
      [vp[3] + vp[0], vp[7] + vp[4], vp[11] + vp[8], vp[15] + vp[12]], // left
      [vp[3] - vp[0], vp[7] - vp[4], vp[11] - vp[8], vp[15] - vp[12]], // right
      [vp[3] + vp[1], vp[7] + vp[5], vp[11] + vp[9], vp[15] + vp[13]], // bottom
      [vp[3] - vp[1], vp[7] - vp[5], vp[11] - vp[9], vp[15] - vp[13]], // top
      [vp[3] + vp[2], vp[7] + vp[6], vp[11] + vp[10], vp[15] + vp[14]], // near
      [vp[3] - vp[2], vp[7] - vp[6], vp[11] - vp[10], vp[15] - vp[14]]  // far
    ].map(p => p.map(x => x / Math.hypot(p[0], p[1], p[2])));

    // Check each chunk against the frustum
    const chunks = this.chunks;

    for (let i = 0; i < chunks.size; i++) {
      const chunk = chunks.values[i];

      if (chunk.blockamount == 0) continue;

      const aabb = chunk.AABB;
      const distance = vec3.distance(aabb.min, camera.position);

      if (distance > RENDER_DISTANCE * CHUNK_SIZE) continue;
      if (distance < 3 * CHUNK_SIZE) {
        filtered.push(chunk);
        continue;
      }

      let outside = false;
      for (const [a, b, c, d] of planes) {
        // Find the corner most inside the frustum
        // To check if the WHOLE box is outside, we test the "positive" vertex
        // (the one furthest in the direction of the plane normal)
        const x = a >= 0 ? aabb.max[0] : aabb.min[0];
        const y = b >= 0 ? aabb.max[1] : aabb.min[1];
        const z = c >= 0 ? aabb.max[2] : aabb.min[2];

        if (a * x + b * y + c * z + d < 0) {
          outside = true;
          break;
        }
      }

      // Inside
      if (!outside) filtered.push(chunk);
    }

    this.rendered = filtered.length;
    return filtered;
  }
}
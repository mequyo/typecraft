/// <reference lib="webworker" />

import { TerrainGenerator } from "./terrain-generator";
import { Sixtuple, WorkerMessageIn, WorkerMessageOut } from "./types";
import { CHUNK_SIZE } from "./constants";
import { Chunk } from "./chunk";
import { BlockRegistry } from "./registries/block-registry";
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { vec3 } from "wgpu-matrix";
import { FACE_NORMALS, FACE_OPPOSITE_BIT, MESHES, ORIENTATION_FACE_MAP } from "./mesh";
import { AIR } from "./registries/blocks";
import { createMeshes } from "./mesh-utils";



const terraingen = new TerrainGenerator();

const MESH_BUFFERS: Sixtuple<Uint32Array> = [
  new Uint32Array((CHUNK_SIZE ** 3) * 6 * 2), // Currently using 2 ints per vertex
  new Uint32Array((CHUNK_SIZE ** 3) * 6 * 2),
  new Uint32Array((CHUNK_SIZE ** 3) * 6 * 2),
  new Uint32Array((CHUNK_SIZE ** 3) * 6 * 2),
  new Uint32Array((CHUNK_SIZE ** 3) * 6 * 2),
  new Uint32Array((CHUNK_SIZE ** 3) * 6 * 2),
];



self.onmessage = async (e: MessageEvent<WorkerMessageIn>) => {
  const { offset } = e.data;

  const { blocks, heightmap, amount } = terraingen.generateBlocks(offset);


  const meshes = createMeshes(MESH_BUFFERS, blocks);

  const amountbuffer = new Uint16Array([amount]).buffer;

  self.postMessage(
    { offset: offset.buffer, blocks: blocks.buffer, heightmap: heightmap.buffer, amount: amountbuffer, meshes: meshes.map(mesh => mesh.buffer) } as WorkerMessageOut,
    [offset.buffer, blocks.buffer, heightmap.buffer, amountbuffer, ...meshes.map(m => m.buffer)],
  );
};



/// <reference lib="webworker" />

import { TerrainGenerator } from "./terrain-generator";
import { Sixtuple, WorkerMessageIn, WorkerMessageOut } from "./types";
import { CHUNK_SIZE } from "./constants";
import { createMeshes } from "./mesh-utils";
import { World } from "./world";

const terraingen = new TerrainGenerator();

const MAX_MESH_SIZE = CHUNK_SIZE ** 3 * 6 * 2; // Currently using 2 ints per vertex, 6 sides per cube
const MESH_BUFFERS: Sixtuple<Uint32Array> = [
  new Uint32Array(MAX_MESH_SIZE),
  new Uint32Array(MAX_MESH_SIZE),
  new Uint32Array(MAX_MESH_SIZE),
  new Uint32Array(MAX_MESH_SIZE),
  new Uint32Array(MAX_MESH_SIZE),
  new Uint32Array(MAX_MESH_SIZE),
];

self.onmessage = async (e: MessageEvent<WorkerMessageIn>) => {
  const { offset, neighbors } = e.data;
  const { blocks, heightmap, amount } = terraingen.generateBlocks(offset);

  const meshes = createMeshes(MESH_BUFFERS, blocks, neighbors);
  const amountbuffer = new Uint16Array([amount]).buffer;
  const key = World.pack(offset[0], offset[1], offset[2]);

  self.postMessage(
    {
      key,
      offset: offset.buffer,
      blocks: blocks.buffer,
      heightmap: heightmap.buffer,
      amount: amountbuffer,
      meshes: meshes.map((mesh) => mesh.buffer),
    } as WorkerMessageOut,
    [
      offset.buffer,
      blocks.buffer,
      heightmap.buffer,
      amountbuffer,
      ...meshes.map((m) => m.buffer),
    ],
  );
};

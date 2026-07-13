/// <reference lib="webworker" />

import { TerrainGenerator } from "./terrain-generator";
import {
  ChunkMessage,
  Sixtuple,
  WorkerMessageIn,
  WorkerMessageOut,
} from "./types";
import { CHUNK_SIZE } from "./constants";
import { createMeshes } from "./mesh-utils";
import { World } from "./world";
import "./registries/blocks";
import { RegistryManagerData } from "./registry-manager";

let registrymanager: null | RegistryManagerData = null;
let terraingen: null | TerrainGenerator = null;

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
  const { type } = e.data;

  switch (type) {
    case "registries":
      registrymanager = e.data.manager;
      terraingen = new TerrainGenerator(registrymanager);
      break;
    case "chunk":
      createChunk(e.data as ChunkMessage);
      break;
  }
};

function createChunk(data: ChunkMessage) {
  if (!terraingen || !registrymanager)
    throw new Error("Terrain Generator or Registry not defined.");

  const { offset, neighborsBuffer } = data;
  const { blocks, heightmap, amount } = terraingen!.generateBlocks(offset);

  const CHUNK_ELEMS = CHUNK_SIZE ** 3;
  const nBuffer = new Uint16Array(neighborsBuffer);
  const neighbors: Sixtuple<Uint16Array> = [
    new Uint16Array(nBuffer.buffer, 0 * CHUNK_ELEMS * 2, CHUNK_ELEMS),
    new Uint16Array(nBuffer.buffer, 1 * CHUNK_ELEMS * 2, CHUNK_ELEMS),
    new Uint16Array(nBuffer.buffer, 2 * CHUNK_ELEMS * 2, CHUNK_ELEMS),
    new Uint16Array(nBuffer.buffer, 3 * CHUNK_ELEMS * 2, CHUNK_ELEMS),
    new Uint16Array(nBuffer.buffer, 4 * CHUNK_ELEMS * 2, CHUNK_ELEMS),
    new Uint16Array(nBuffer.buffer, 5 * CHUNK_ELEMS * 2, CHUNK_ELEMS),
  ];

  const meshes = createMeshes(
    MESH_BUFFERS,
    blocks,
    neighbors,
    registrymanager.blockstates,
  );
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
}

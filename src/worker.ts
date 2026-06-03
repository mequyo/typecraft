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
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { RegistryManager, RegistryManagerData } from "./registry-manager";
import { Registry } from "./registry";

BlockStateRegistry.build();
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

let registrymanager: null | RegistryManagerData = null;

self.onmessage = async (e: MessageEvent<WorkerMessageIn>) => {
  const { type } = e.data;

  switch (type) {
    case "registries":
      registrymanager = e.data.manager;
      console.log(Registry.get(registrymanager.blocks, "name", "sand"));
      break;
    case "chunk":
      createChunk(e.data as ChunkMessage);
      break;
  }
};

function createChunk(data: ChunkMessage) {
  const { offset, neighbors } = data;
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
}

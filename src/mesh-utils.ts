import { CHUNK_SIZE } from "./constants";
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { AIR } from "./registries/blocks";
import { vec3 } from "wgpu-matrix";
import { Chunk } from "./chunk";
import { BlockRegistry } from "./registries/block-registry";
import { FACE_NORMALS, FACE_OPPOSITE_BIT, MESHES, ORIENTATION_FACE_MAP } from "./mesh";
import { Sixtuple } from "./types";


export function createMeshes(buffers: Sixtuple<Uint32Array>, blocks: Uint16Array): Sixtuple<Uint32Array> {
  let offsets: Sixtuple<number> = [0, 0, 0, 0, 0, 0];

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {

        const blockstate = blocks[Chunk.pack(x, y, z)];
        const { block: blockID, orientation } = BlockStateRegistry.decode(blockstate);
        const block = BlockRegistry.get(blockID);

        if (blockID == AIR.ID) continue;

        const mesh = MESHES[block.meshID];
        let n = vec3.create(); // Reusable 

        for (let face = 0; face < 6; face += 1) {
          const localface = ORIENTATION_FACE_MAP[orientation][face];
          const texture = block.textures[localface % block.textures.length].ID; // Wrap with modulo in case of one single texture
          const vec = FACE_NORMALS[face]; // Neighbor offset

          n = vec3.set(x + vec[0], y + vec[1], z + vec[2]); // Neighbor position

          // TODO if out of bounds, go to world and get neighbor chunk
          // PROBLEM worker doesn't know about the full world
          if (n[0] < 0 || n[1] < 0 || n[2] < 0 || n[0] >= CHUNK_SIZE || n[1] >= CHUNK_SIZE || n[2] >= CHUNK_SIZE || mesh.cullingmasks[orientation] == 0) {
            offsets[face] += mesh.writeFace(buffers[face], offsets[face], x, y, z, texture, face, orientation);
            continue;
          }

          const neighbor_state = blocks[Chunk.pack(n[0], n[1], n[2])];
          const { block: neighborBlockID, orientation: neighborOrientation } = BlockStateRegistry.decode(neighbor_state);
          const neighborBlock = BlockRegistry.get(neighborBlockID);
          const neighborMesh = MESHES[neighborBlock.meshID];

          // Skip face only if BOTH the neighbor and the current face occlude
          const neighborOccludes = (neighborMesh.cullingmasks[neighborOrientation] & (FACE_OPPOSITE_BIT[face])) !== 0;
          const selfOccludes = (mesh.cullingmasks[orientation] & (1 << face)) !== 0;

          if (neighborBlock.ID != AIR.ID && neighborOccludes && selfOccludes) continue;

          offsets[face] += mesh.writeFace(buffers[face], offsets[face], x, y, z, texture, face, orientation);
        }
      }
    }
  }

  return buffers.map((buffer, i) => buffer.slice(0, offsets[i])) as Sixtuple<Uint32Array>;
}

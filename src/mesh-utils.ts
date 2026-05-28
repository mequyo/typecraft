import { CHUNK_SIZE } from "./constants";
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { AIR } from "./registries/blocks";
import { vec3 } from "wgpu-matrix";
import { Chunk } from "./chunk";
import { BlockRegistry } from "./registries/block-registry";
import {
  FACE,
  FACE_NORMALS,
  FACE_OPPOSITE_BIT,
  MESHES,
  ORIENTATION_FACE_MAP,
} from "./mesh";
import { Sixtuple } from "./types";

export function createMeshes(
  buffers: Sixtuple<Uint32Array>,
  blocks: Uint16Array,
  neighbors: Sixtuple<Uint16Array | undefined>,
): Sixtuple<Uint32Array> {
  let offsets: Sixtuple<number> = [0, 0, 0, 0, 0, 0];
  let n = vec3.create(); // Reuse

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const blockstate = blocks[Chunk.pack(x, y, z)];
        const { blockID, properties } = BlockStateRegistry.decode(blockstate);
        const orientation = properties.orientation;
        const block = BlockRegistry.get(blockID);

        if (blockID == AIR.ID) continue;

        const mesh = MESHES[block.meshID];
        vec3.set(0, 0, 0, n);

        for (let face = 0; face < 6; face += 1) {
          const localface = ORIENTATION_FACE_MAP[orientation][face];
          const texture = block.textures[localface % block.textures.length].ID; // Wrap with modulo in case of one single texture
          const vec = FACE_NORMALS[face]; // Neighbor offset

          n = vec3.set(x + vec[0], y + vec[1], z + vec[2]); // Neighbor position

          // Non-occluding e.g. fences or slabs
          if (mesh.cullingmasks[orientation] == 0) {
            offsets[face] += mesh.writeFace(
              buffers[face],
              offsets[face],
              x,
              y,
              z,
              texture,
              face,
              orientation,
            );
            continue;
          }

          let neighbor_state = -1;

          if (n[0] >= CHUNK_SIZE) {
            neighbor_state =
              neighbors[FACE.PX]?.[Chunk.pack(n[0] - CHUNK_SIZE, n[1], n[2])] ||
              -1;
          } else if (n[0] < 0) {
            neighbor_state =
              neighbors[FACE.NX]?.[Chunk.pack(n[0] + CHUNK_SIZE, n[1], n[2])] ||
              -1;
          } else if (n[1] >= CHUNK_SIZE) {
            neighbor_state =
              neighbors[FACE.PY]?.[Chunk.pack(n[0], n[1] - CHUNK_SIZE, n[2])] ||
              -1;
          } else if (n[1] < 0) {
            neighbor_state =
              neighbors[FACE.NY]?.[Chunk.pack(n[0], n[1] + CHUNK_SIZE, n[2])] ||
              -1;
          } else if (n[2] >= CHUNK_SIZE) {
            neighbor_state =
              neighbors[FACE.PZ]?.[Chunk.pack(n[0], n[1], n[2] - CHUNK_SIZE)] ||
              -1;
          } else if (n[2] < 0) {
            neighbor_state =
              neighbors[FACE.NZ]?.[Chunk.pack(n[0], n[1], n[2] + CHUNK_SIZE)] ||
              -1;
          } else {
            neighbor_state = blocks[Chunk.pack(n[0], n[1], n[2])];
          }

          if (neighbor_state == -1) {
            offsets[face] += mesh.writeFace(
              buffers[face],
              offsets[face],
              x,
              y,
              z,
              texture,
              face,
              orientation,
            );
            continue;
          }

          const { blockID: neighborBlockID, properties: neighborprop } =
            BlockStateRegistry.decode(neighbor_state);
          const neighborOrientation = neighborprop.orientation;
          const neighborBlock = BlockRegistry.get(neighborBlockID);
          const neighborMesh = MESHES[neighborBlock.meshID];

          // Skip face only if BOTH the neighbor and the current face occlude
          const neighborOccludes =
            (neighborMesh.cullingmasks[neighborOrientation] &
              FACE_OPPOSITE_BIT[face]) !==
            0;
          const selfOccludes =
            (mesh.cullingmasks[orientation] & (1 << face)) !== 0;

          if (neighborBlock.ID != AIR.ID && neighborOccludes && selfOccludes)
            continue;

          offsets[face] += mesh.writeFace(
            buffers[face],
            offsets[face],
            x,
            y,
            z,
            texture,
            face,
            orientation,
          );
        }
      }
    }
  }

  return buffers.map((buffer, i) =>
    buffer.slice(0, offsets[i]),
  ) as Sixtuple<Uint32Array>;
}

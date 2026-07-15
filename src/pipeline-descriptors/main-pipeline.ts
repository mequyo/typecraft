import { RenderPipeline } from "../render-pipeline";
import mainvertex from "../shaders/main.wgsl?raw";
import { vec3 } from "wgpu-matrix";
import { World } from "../world";
import {
  AMBIENT_COLOR,
  CHUNK_SIZE,
  CONE_ANGLE,
  CONE_DISTANCE,
  CONE_ITERATIONS,
  FADE_IN_DURATION,
  FOG_COLOR,
  FOG_END,
  FOG_START,
  CONE_INDIRECT_SAMPLE_COUNT,
  SKY_RADIANCE,
  SUN_COLOR,
  SUN_DIRECTION,
} from "../constants";
import { ReadOnlyStorage, Sampler, Texture, Uniform } from "../lib";

export const MAIN_PIPELINE = (
  device: GPUDevice,
  textureview: GPUTextureView,
): RenderPipeline => {
  const BLOCKS = 32 ** 3;
  const STRIDE = BLOCKS + 3 + 1; // 32768 blocks + origin + time

  const GPUChunks: Map<number, number> = new Map(); // ChunkID -> BufferIndex
  let slot = 0;

  return new RenderPipeline({
    device,
    module: device.createShaderModule({ code: mainvertex }),
    descriptor: {
      vertex: {
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 8,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "uint32" }, // [5 bits x, 5 bits y, 5 bits z, 10 bits texture, ...]
              { shaderLocation: 1, offset: 4, format: "uint32" }, // [16 bits u, 16 bits v]
            ],
          },
        ],
      },
      fragment: {
        entryPoint: "fs_main",
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
        frontFace: "ccw",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    },

    groups: [
      // TEXTURES
      [
        Sampler({ device, type: "filtering" }),
        Texture({
          sampleType: "float",
          viewDimension: "2d-array",
          resource: textureview,
        }),
      ],

      // STORAGE BUFFERS
      [
        // Chunk Buffer
        ReadOnlyStorage(device, "1GB", (state, buffer) => {
          const chunks = state.world.chunks.values;
          const data = new Int32Array(STRIDE);

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const offset = chunk.offset;
            const ID = World.pack(offset[0], offset[1], offset[2]);

            if (GPUChunks.get(ID) !== undefined) continue;

            data.set(chunk.blocks, 0);
            data[BLOCKS + 0] = chunk.offset[0];
            data[BLOCKS + 1] = chunk.offset[1];
            data[BLOCKS + 2] = chunk.offset[2];
            data[BLOCKS + 3] = 1000 * chunk.timestamp;

            buffer.write(data, slot * STRIDE * Int32Array.BYTES_PER_ELEMENT);
            GPUChunks.set(ID, slot);
            slot++;
          }
        }),
        // Indirection
        ReadOnlyStorage(device, "100MB", (state, buffer) => {
          state.gpuIndrectionChunkMap.fill(0xffffffff);

          const chunks = state.world.chunks.values;

          // 2. Rebuild the map using the chunk's actual SSBO slot
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const ID = World.pack(
              chunk.offset[0],
              chunk.offset[1],
              chunk.offset[2],
            );
            const chunkSlot = GPUChunks.get(ID);

            if (chunkSlot !== undefined) {
              const trnsf = vec3.sub(
                chunk.offset,
                state.gpuIndirectionBufferOrigin,
              );
              const indirectionID = World.packIndirection(
                trnsf[0],
                trnsf[1],
                trnsf[2],
                state.render_distance,
              );

              if (indirectionID !== 0xffffffff) {
                state.gpuIndrectionChunkMap[indirectionID] = chunkSlot;
              }
            }
          }

          buffer.write(state.gpuIndrectionChunkMap);
        }),
      ],

      // UNIFORMS
      [
        Uniform(device, new Float32Array(68), (state, buffer) => {
          const look = state.player.lookat;
          const data = new Float32Array(68);

          data.set(state.player.projection, 0);
          data.set(state.player.view(state.alpha), 16);
          data.set(state.player.interpolate(state.alpha), 32);
          data.set(look ?? [0, 0, 0], 36);
          data.set(
            [state.time.seconds, FADE_IN_DURATION, FOG_START, FOG_END],
            39,
          );
          data.set(FOG_COLOR, 44);
          data.set(SUN_DIRECTION, 48);
          data.set(SUN_COLOR, 52);
          data.set(AMBIENT_COLOR, 56);
          data.set(SKY_RADIANCE, 60);
          data.set([CONE_ANGLE, CONE_DISTANCE], 63);

          buffer.write(data);
        }),
        Uniform(device, new Int32Array(8), (state, buffer) => {
          const origin = vec3.floor(
            vec3.divScalar(state.player.position, CHUNK_SIZE),
          );
          const data = new Int32Array([
            origin[0],
            origin[1],
            origin[2],
            2 * state.render_distance + 1,
            0, // air ID
            CHUNK_SIZE,
            CONE_ITERATIONS, // cone iterations
            CONE_INDIRECT_SAMPLE_COUNT, // indirect sample count
          ]);

          buffer.write(data);
        }),
      ],
    ],

    draw(pass, self, state) {
      pass.setPipeline(self.pipeline);

      for (let i = 0; i < self.groups.length; i++) {
        pass.setBindGroup(i, self.groups[i].group);
      }

      pass.setVertexBuffer(0, state.chunkBuffer.buffer);

      const chunks = state.world.chunks.values;
      const indirect = new Uint32Array(4 * 6 * state.world.filtered.length);

      for (let i = 0, offset = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        if (!chunk.visible) continue;

        const relative = vec3.sub(
          chunk.offset,
          state.gpuIndirectionBufferOrigin,
        );
        const packed = World.packIndirection(
          relative[0],
          relative[1],
          relative[2],
          state.render_distance,
        );

        if (packed == 0xffffffff) continue;

        for (let face = 0; face < 6; face += 1) {
          // allocations.size/start are in bytes; each vertex is 8 bytes (two u32), so divide by 8
          indirect[offset++] = chunk.allocations[face].size / 8; // vertexCount
          indirect[offset++] = 1; // instanceCount
          indirect[offset++] = chunk.allocations[face].start / 8; // firstVertex
          indirect[offset++] = (packed << 3) | (face << 0); // firstInstance (29 bits chunkIndex, 3 bits face 0-5)
        }
      }

      if (indirect.length === 0) return;

      const buffer = state.indirectBuffer;
      buffer.write(indirect);
      // @ts-ignore, only available through extension
      pass.multiDrawIndirect(buffer.handle, 0, indirect.length / 4);
    },
  });
};

import code from "../shaders/ghost.wgsl?raw";
import { RenderPipeline } from "../render-pipeline";
import { DynamicBuffer } from "../classes/dynamic-buffer";
import { mat4, Vec3, vec3 } from "wgpu-matrix";
import { DESTROY_STAGE_TEXTURES } from "../registries/textures";
import { cube } from "../cube";
import { FLOATS_PER_VERTEX } from "../constants";
import {
  FACE,
  Mesh,
  MESHES,
  NORMAL_TO_ORIENTATION,
  ORIENTATION,
  ROTATION,
} from "../mesh";
import { BlockRegistry } from "../registries/block-registry";
import { Registry } from "../registry";

export const GHOST_PIPELINE = (
  device: GPUDevice,
  textureview: GPUTextureView,
): RenderPipeline => {
  const buffer = new DynamicBuffer({
    device,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
  });

  return new RenderPipeline({
    device,
    module: device.createShaderModule({ code }),
    descriptor: {
      vertex: {
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 36,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 12, format: "float32x3" },
              { shaderLocation: 2, offset: 24, format: "float32x2" },
              { shaderLocation: 3, offset: 32, format: "float32" },
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
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: "depth24plus",
      },
      primitive: { topology: "triangle-list", cullMode: "back" },
    },

    groups: [
      // TEXTURES
      [
        {
          sampler: { type: "filtering" },
          resource: device.createSampler(),
        },
        {
          texture: {
            sampleType: "float",
            viewDimension: "2d-array",
            multisampled: false,
          },
          resource: textureview,
        },
      ],
      // UNIFORMS
      [
        {
          buffer: { type: "uniform" },
          resource: new DynamicBuffer({
            device,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            data: mat4.create(),
            }),
          update: (state, buffer) => buffer.write(state.player.projection),
        },
        {
          buffer: { type: "uniform" },
          resource: new DynamicBuffer({
            device,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            data: mat4.create(),
          }),
          update: (state, buffer) =>
            buffer.write(state.player.view(state.alpha)),
        },
      ],
    ],

    draw: (pass, self, state) => {
      const lookat = state.player.lookat;
      if (!lookat) return;

      //const blockstate = state.world.getBlockState(lookat);
      const selected = state.player.hotbar[0][state.player.selectedSlot];
      if (!selected || !selected[1]) return;

      let block = null;
      try {
        block = Registry.get(state.registrymanager.blocks, "name", selected[1]);
      } catch (_) {
        return;
      }

      const mesh = MESHES[block.meshID];
      const position = vec3.sub(lookat, state.player.placeoffset);
      const meshbuffer = mesh.getFullMesh(
        position[0],
        position[1],
        position[2],
        true,
        true,
        block,
        NORMAL_TO_ORIENTATION(state.player.placeoffset, state.player.lookatuv),
      );

      buffer.write(meshbuffer);

      for (let i = 0; i < self.groups.length; i++) {
        pass.setBindGroup(i, self.groups[i].group);
      }

      pass.setPipeline(self.pipeline);
      pass.setVertexBuffer(0, buffer.handle);
      pass.draw(buffer.bytesUsed / 9 / Float32Array.BYTES_PER_ELEMENT);
    },
  });
};

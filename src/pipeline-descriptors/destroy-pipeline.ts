// DESTROY PIPELINE
import code from "../shaders/destroy.wgsl?raw";
import { RenderPipeline } from "../render-pipeline";
import { DynamicBuffer } from "../classes/dynamic-buffer";
import { mat4 } from "wgpu-matrix";
import { DESTROY_STAGE_TEXTURES } from "../registries/textures";
import { cube } from "../cube";
import { FLOATS_PER_VERTEX } from "../constants";



export const DESTROY_PIPELINE = (device: GPUDevice, textureview: GPUTextureView): RenderPipeline => new RenderPipeline({
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
          ]
        }
      ],
    },
    fragment: {
      entryPoint: "fs_main",
      targets: [{
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
      }]
    },
    depthStencil: {
      depthWriteEnabled: false,
      depthCompare: "less-equal",
      format: "depth24plus",
    },
  },

  groups: [
    // TEXTURES
    [{
      sampler: { type: "filtering" },
      resource: device.createSampler(),
    }, {
      texture: { sampleType: "float", viewDimension: "2d-array", multisampled: false },
      resource: textureview,
    }],
    // UNIFORMS
    [{
      buffer: { type: "uniform" },
      resource: new DynamicBuffer(device, GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM, mat4.create()),
      update: (state, buffer) => buffer.write(state.player.projection),
    }, {
      buffer: { type: "uniform" },
      resource: new DynamicBuffer(device, GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM, mat4.create()),
      update: (state, buffer) => buffer.write(state.player.view),
    }]
  ],



  draw: (pass, self, state) => {
    if (state.world.damaged.size == 0) return;

    // TODO draw inside mesh, not a full cube
    // Turn damaged blocks into meshes
    const faces = 6;
    const triangles = 6;
    const mesh = new Float32Array(state.world.damaged.size * faces * FLOATS_PER_VERTEX * triangles);
    const values = Array.from(state.world.damaged.values());
    let offset = 0;

    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const STAGE = DESTROY_STAGE_TEXTURES[Math.floor(value.damage / value.hardness * DESTROY_STAGE_TEXTURES.length)];

      offset += cube.write_back_face(mesh, offset, value.position[0], value.position[1], value.position[2], STAGE.ID, 1.001);
      offset += cube.write_front_face(mesh, offset, value.position[0], value.position[1], value.position[2], STAGE.ID, 1.001);
      offset += cube.write_bottom_face(mesh, offset, value.position[0], value.position[1], value.position[2], STAGE.ID, 1.001);
      offset += cube.write_left_face(mesh, offset, value.position[0], value.position[1], value.position[2], STAGE.ID, 1.001);
      offset += cube.write_right_face(mesh, offset, value.position[0], value.position[1], value.position[2], STAGE.ID, 1.001);
      offset += cube.write_top_face(mesh, offset, value.position[0], value.position[1], value.position[2], STAGE.ID, 1.001);
    }

    for (let i = 0; i < self.groups.length; i++) {
      pass.setBindGroup(i, self.groups[i].group);
    }

    pass.setPipeline(self.pipeline);

    const buffer = new DynamicBuffer(device, GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX, mesh);

    pass.setVertexBuffer(0, buffer.handle);
    pass.draw(buffer.capacity / 9 / Float32Array.BYTES_PER_ELEMENT);
  },
});

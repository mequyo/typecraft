import { mat4, vec3 } from "wgpu-matrix";
import { DynamicBuffer } from "../classes/dynamic-buffer";
import { MESHES } from "../mesh";
import { RenderPipeline } from "../render-pipeline";
import { BlockRegistry } from "../registries/block-registry";
import { BlockStateRegistry } from "../registries/blockstate-registry";
import code from "../shaders/outline.wgsl?raw";



export const OUTLINE_PIPELINE = (device: GPUDevice) => new RenderPipeline({
  device,
  module: device.createShaderModule({ code }),
  descriptor: {
    vertex: {
      entryPoint: "vs_main",
      buffers: [{
        arrayStride: 16,
        attributes: [{
          shaderLocation: 0, offset: 0, format: "float32x3",
        }, {
          shaderLocation: 1, offset: 12, format: "float32",
        }]
      }]
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
          }
        }
      }],
    },
    depthStencil: {
      depthWriteEnabled: false,
      depthCompare: "less-equal",
      format: "depth24plus",
    },
    primitive: { topology: "triangle-list", cullMode: "back" },
  },

  groups: [
    [{
      buffer: { type: "uniform" },  // projection
      resource: new DynamicBuffer(device, GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM, mat4.create()),
      update: (state, buffer) => buffer.write(state.player.projection),
    }, {
      buffer: { type: "uniform" }, // view
      resource: new DynamicBuffer(device, GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM, mat4.create()),
      update: (state, buffer) => buffer.write(state.player.view),
    }, {
      buffer: { type: "uniform" },  // block position
      resource: new DynamicBuffer(device, GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM, vec3.create()),
      update: (state, buffer) => state.player.lookat ? buffer.write(state.player.lookat) : null,
    }, {
      buffer: { type: "uniform" },  // camera position
      resource: new DynamicBuffer(device, GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM, vec3.create()),
      update: (state, buffer) => buffer.write(state.player.position),
    },
    ]
  ],



  draw: (pass, self, state) => {
    if (!state.player.lookat) return;

    pass.setPipeline(self.pipeline);
    pass.setBindGroup(0, self.groups[0].group);

    const blockstate = state.world.getBlockState(state.player.lookat);
    const { block: blockID, orientation } = BlockStateRegistry.decode(blockstate);
    const mesh = MESHES[BlockRegistry.get(blockID).meshID].getFullMesh(0, 0, 0, false, false, 0, orientation); // xyzt where t is just scrap
    const outlinebuffer = new DynamicBuffer(device, GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX, mesh);

    pass.setVertexBuffer(0, outlinebuffer.handle);
    pass.draw(outlinebuffer.capacity / Float32Array.BYTES_PER_ELEMENT / 4); // 6 vertices, 12 edges
  }
});

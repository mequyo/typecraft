import { DynamicBuffer } from "../classes/dynamic-buffer";
import { RenderPipeline } from "../render-pipeline";
import mainvertex from "../shaders/main.wgsl?raw"
import { mat4, vec3 } from "wgpu-matrix";



export const MAIN_PIPELINE = (device: GPUDevice, textureview: GPUTextureView): RenderPipeline => new RenderPipeline({
  device,
  module: device.createShaderModule({ code: mainvertex }),
  descriptor: {
    vertex: {
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 8,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "uint32" },  // [5 bits x, 5 bits y, 5 bits z, 10 bits texture, ...]
            { shaderLocation: 1, offset: 4, format: "uint32" }, // [16 bits u, 16 bits v] 
          ]
        }
      ]
    },
    fragment: {
      entryPoint: "fs_main",
      targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }]
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
    [{
      sampler: { type: "filtering" },
      resource: device.createSampler(),
    }, {
      texture: { sampleType: "float", viewDimension: "2d-array", multisampled: false },
      resource: textureview,
    }],
    [{
      buffer: { type: "read-only-storage" },
      resource: new DynamicBuffer(device, GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE),
      update: (state, buffer) => {
        const filtered = state.world.filtered;
        const data = new Float32Array(4 * filtered.length);

        for (let c = 0; c < filtered.length; c++) {
          const chunk = filtered[c];
          const i = 4 * c;

          data[i + 0] = chunk.offset[0];
          data[i + 1] = chunk.offset[1];
          data[i + 2] = chunk.offset[2];
          data[i + 3] = chunk.timestamp;
        }

        buffer.write(new Float32Array(data));
      },
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
    }, {
      buffer: { type: "uniform" },
      resource: new DynamicBuffer(device, GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM, vec3.create()),
      update: (state, buffer) => buffer.write(state.player.position),
    }, {
      buffer: { type: "uniform" },
      resource: new DynamicBuffer(device, GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM, new Float32Array([0])),
      update: (state, buffer) => buffer.write(new Float32Array([state.time.seconds])),
    }],
  ],



  draw(pass, self, state) {
    pass.setPipeline(self.pipeline);

    for (let i = 0; i < self.groups.length; i++) {
      pass.setBindGroup(i, self.groups[i].group);
    }

    pass.setVertexBuffer(0, state.chunkBuffer.buffer);


    const filtered = state.world.filtered; // Removes empty and out of frustum chunks

    // TEST multi draw
    const indirect: number[] = [];

    for (let i = 0; i < filtered.length; i++) {
      const chunk = filtered[i];

      for (let face = 0; face < 6; face += 1) {
        // vertexCount, instanceCount, firstVertex, and firstInstance (29 bits of chunkIndex and 3 bits for face (0-5))
        // allocations.size/start are in bytes; each vertex is 8 bytes (two u32), so divide by 8
        indirect.push(chunk.allocations[face].size / 8, 1, chunk.allocations[face].start / 8, (i << 3) | face);
      }
    }

    if (indirect.length === 0) return;

    const drawData = new Uint32Array(indirect);

    state.indirectBuffer.write(drawData);

    // @ts-ignore, only available through extension
    pass.multiDrawIndirect(state.indirectBuffer.handle, 0, drawData.length / 4);
  },
});
import { Mat4, mat4 } from "wgpu-matrix";
import { DynamicBuffer } from "../classes/dynamic-buffer";
import { RenderPipeline } from "../render-pipeline";
import code from "../shaders/sky.wgsl?raw";

export const SKY_PIPELINE = (device: GPUDevice): RenderPipeline =>
  new RenderPipeline({
    device,
    module: device.createShaderModule({ code }),
    descriptor: {
      vertex: {
        entryPoint: "vs_main",
        buffers: undefined,
      },
      fragment: {
        entryPoint: "fs_main",
        targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
      },
      primitive: { topology: "triangle-list" },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: false,
        depthCompare: "always",
      },
    },

    groups: [
      [
        {
          buffer: { type: "uniform" },
          resource: new DynamicBuffer({
            device,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            data: mat4.create(),
            }),
          update: (state, buffer) => {
            const copy = mat4.clone(state.player.view(state.alpha));
            copy[12] = 0;
            copy[13] = 0;
            copy[14] = 0;

            const viewProj = mat4.multiply(state.player.projection, copy); // proj * view
            const result = mat4.invert(viewProj); // single invert

            return buffer.write(result);
          },
        },
      ],
    ],

    draw: (pass, self, _) => {
      pass.setPipeline(self.pipeline);
      pass.setBindGroup(0, self.groups[0].group);
      pass.draw(6);
    },
  });

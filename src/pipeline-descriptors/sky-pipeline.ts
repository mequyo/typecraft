import { mat4 } from "wgpu-matrix";
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
          resource: new DynamicBuffer(
            device,
            GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            mat4.create(),
          ),
          update: (state, buffer) =>
            buffer.write(
              mat4.multiply(
                mat4.invert(state.player.projection),
                mat4.invert(state.player.view()),
              ),
            ),
        },
      ],
    ],

    draw: (pass, self, _) => {
      pass.setPipeline(self.pipeline);
      pass.setBindGroup(0, self.groups[0].group);
      pass.draw(6);
    },
  });

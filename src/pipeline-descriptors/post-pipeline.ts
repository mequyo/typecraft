// DESTROY PIPELINE
import code from "../shaders/post.wgsl?raw";
import { RenderPipeline } from "../render-pipeline";
import { vec3 } from "wgpu-matrix";
import { DynamicBuffer } from "../classes/dynamic-buffer";

export const POST_PIPELINE = (
  device: GPUDevice,
  outlineTextureView: GPUTextureView,
): RenderPipeline =>
  new RenderPipeline({
    device,
    module: device.createShaderModule({ code }),
    descriptor: {
      vertex: {
        entryPoint: "vs_main",
        buffers: [],
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
    },
    groups: [
      [
        {
          sampler: { type: "filtering" },
          resource: device.createSampler(),
        },
        {
          texture: { sampleType: "float", viewDimension: "2d" },
          resource: outlineTextureView,
        },
      ],
      // UNIFORMS
      [
        {
          buffer: { type: "uniform" },
          resource: new DynamicBuffer(
            device,
            GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            vec3.create(1.0, 1.0, 1.0),
          ),
        },
        {
          buffer: { type: "uniform" },
          resource: new DynamicBuffer(
            device,
            GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            new Float32Array([2.0]),
          ),
        },
      ],
    ],

    draw: (pass, self, state) => {
      pass.setPipeline(self.pipeline);
      for (let i = 0; i < self.groups.length; i++) {
        pass.setBindGroup(i, self.groups[i].group);
      }
      pass.draw(3); // Fullscreen triangle
    },
  });

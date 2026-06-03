import { mat4, vec2, vec3 } from "wgpu-matrix";
import { DynamicBuffer } from "../classes/dynamic-buffer";
import { MESHES, ORIENTATION } from "../mesh";
import { RenderPipeline } from "../render-pipeline";
import { BlockRegistry } from "../registries/block-registry";
import code from "../shaders/outline.wgsl?raw";
import { Registry } from "../registry";

export const OUTLINE_PIPELINE = (device: GPUDevice) => {
  const outlinebuffer = new DynamicBuffer(
    device,
    GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
  );
  return new RenderPipeline({
    device,
    module: device.createShaderModule({ code }),
    descriptor: {
      vertex: {
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: Float32Array.BYTES_PER_ELEMENT * 4,
            attributes: [
              {
                shaderLocation: 0, // p1
                offset: 0,
                format: "float32x3",
              },
              {
                shaderLocation: 1, // p2
                offset: 12,
                format: "float32",
              },
            ],
          },
        ],
      },
      fragment: {
        entryPoint: "fs_main",
        targets: [
          {
            format: "rgba8unorm",
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
      [
        {
          buffer: { type: "uniform" }, // projection
          resource: new DynamicBuffer(
            device,
            GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            mat4.create(),
          ),
          update: (state, buffer) => buffer.write(state.player.projection),
        },
        {
          buffer: { type: "uniform" }, // view
          resource: new DynamicBuffer(
            device,
            GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            mat4.create(),
          ),
          update: (state, buffer) =>
            buffer.write(state.player.view(state.alpha)),
        },
        {
          buffer: { type: "uniform" }, // camera position
          resource: new DynamicBuffer(
            device,
            GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            vec3.create(),
          ),
          update: (state, buffer) => buffer.write(state.player.placeoffset),
        },
        {
          buffer: { type: "uniform" }, // screen space
          resource: new DynamicBuffer(
            device,
            GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            vec2.create(1920, 1080),
          ),
          update: (state, buffer) =>
            buffer.write(vec2.create(state.canvas.width, state.canvas.height)),
        },
      ],
    ],

    draw: (pass, self, state) => {
      const look = state.player.lookat;
      if (!look) return;

      pass.setPipeline(self.pipeline);
      pass.setBindGroup(0, self.groups[0].group);

      const hash = state.world.getBlockState(look);
      const blockstate = Registry.get(
        state.registrymanager.blockstates,
        "hash",
        hash,
      );
      const { properties } = blockstate;
      const block = blockstate.block;
      const orientation = properties.orientation as ORIENTATION;

      const meshType = MESHES[BlockRegistry.get(block.ID).meshID];
      const mesh = meshType.getFullMesh(
        look[0],
        look[1],
        look[2],
        false, // normals
        false, // uvs
        block,
        orientation,
      );
      outlinebuffer.write(mesh);

      pass.setVertexBuffer(0, outlinebuffer.handle);
      pass.draw(outlinebuffer.capacity / Float32Array.BYTES_PER_ELEMENT / 4); // p1 p2 quadCoord (u, v)
    },
  });
};

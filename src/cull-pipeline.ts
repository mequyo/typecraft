import cullShaderSource from "./shaders/cull.wgsl?raw";

export type CullResources = {
  pipeline: GPUComputePipeline;
  bindGroup: GPUBindGroup;
  chunkMetaBuffer: GPUBuffer;
  planesBuffer: GPUBuffer;
  originBuffer: GPUBuffer;
  maxChunkSlots: number;
  indirectBuffer: GPUBuffer;
};

export function createCullPipeline(
  device: GPUDevice,
  indirectBuffer: GPUBuffer,
  maxChunkSlots: number,
): CullResources {
  const module = device.createShaderModule({ code: cullShaderSource });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" },
      },
    ],
  });

  const pipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    compute: { module, entryPoint: "main" },
  });

  const CHUNK_META_STRIDE = 8 * 16; // 128 bytes, matches ChunkMeta above

  const chunkMetaBuffer = device.createBuffer({
    size: maxChunkSlots * CHUNK_META_STRIDE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const planesBuffer = device.createBuffer({
    size: 6 * 4 * 4, // 6 vec4f
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const originBuffer = device.createBuffer({
    size: 4 * 4, // vec4<i32>
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: chunkMetaBuffer } },
      { binding: 1, resource: { buffer: planesBuffer } },
      { binding: 2, resource: { buffer: indirectBuffer } },
      { binding: 3, resource: { buffer: originBuffer } },
    ],
  });

  return {
    pipeline,
    bindGroup,
    chunkMetaBuffer,
    planesBuffer,
    originBuffer,
    maxChunkSlots,
    indirectBuffer,
  };
}

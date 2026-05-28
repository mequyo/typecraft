// export type WorkerMessageOut = { offset: ArrayBuffer, blocks: ArrayBuffer, heightmap: ArrayBuffer, bitmap: ImageBitmap, mesh: ArrayBuffer, amount: ArrayBuffer }
import { Vec3 } from "wgpu-matrix";
import code from "./shaders/terrain.wgsl?raw";
import { World } from "./world";
import { AIR, COBBLESTONE } from "./registries/blocks";
import { SparseSet } from "./classes/sparse-set";

// for now
// use compute shader to generate heightmap
// use existing terrain generator to create map

export function generateBlocksCompute(
  device: GPUDevice,
  size: number,
  world: World,
  chunkOffset: Vec3,
) {
  const paramData = new Float32Array([
    chunkOffset[0],
    chunkOffset[1],
    chunkOffset[2],
    size,
  ]); // Four entries to make it uniform aligned (16 bytes aligned)
  const paramBuffer = device.createBuffer({
    size: paramData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(paramBuffer, 0, paramData);

  const elementCount = size * size * size;
  const outSizeBytes = 4 * elementCount;

  // GPU writes here
  const blocksBuffer = device.createBuffer({
    size: outSizeBytes,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  // CPU reads back from here
  const blocksReadBackBuffer = device.createBuffer({
    size: outSizeBytes,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  // Pipeline
  const module = device.createShaderModule({ code });

  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module, entryPoint: "main" },
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramBuffer } },
      { binding: 1, resource: { buffer: blocksBuffer } },
    ],
  });

  // Encoder

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);

  // Match workgroup_size(4, 4, 4)
  const wgX = 4;
  const wgY = 4;
  const wgZ = 4;
  const dispatchX = Math.ceil(size / wgX);
  const dispatchY = Math.ceil(size / wgY);
  const dispatchZ = Math.ceil(size / wgZ);

  pass.dispatchWorkgroups(dispatchX, dispatchY, dispatchZ); // Start work
  pass.end();

  // Copy GPU output -> readback buffer
  encoder.copyBufferToBuffer(
    blocksBuffer,
    0,
    blocksReadBackBuffer,
    0,
    outSizeBytes,
  );

  device.queue.submit([encoder.finish()]);

  // Map and read

  blocksReadBackBuffer.mapAsync(GPUMapMode.READ).then(() => {
    const start = performance.now();
    const mapped = blocksReadBackBuffer.getMappedRange();

    const copy = mapped.slice(0);

    blocksReadBackBuffer.unmap();
    //console.log((performance.now() - start))
    const blocks = new Float32Array(copy).map((block) =>
      block > 0.5 ? COBBLESTONE.ID : AIR.ID,
    );
    console.log(blocks.length);
  });
}

/*

Blöcke:
Meshes sind für viele Blöcke gleich, also -> MeshID + texture
Main Pipeline bekommt:


Items haben alle unterschiedliche meshes, die aber alle at runtime generiert werden müssen



blockstate -> blockID, orientation, layers, etc.
blockID, orientation, ... -> blockstate





*/

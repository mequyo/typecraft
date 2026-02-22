import code from "../shaders/terrain.wgsl?raw"
import { DynamicBuffer } from "../classes/dynamic-buffer";
import { ComputeKernel } from "../compute-pipeline";
import { vec4 } from "wgpu-matrix";
import { CHUNK_SIZE, WORKGROUP_SIZE } from "../constants";



export class ChunkBlocksComputePipeline extends ComputeKernel<"params" | "blocks"> {

  constructor(device: GPUDevice) {
    super({
      device,
      descriptor: {
        layout: "auto",
        compute: { module: device.createShaderModule({ code }) },
      },
      groups: [
        [{
          label: "params",
          buffer: { type: "uniform" },
          resource: new DynamicBuffer(device, GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM, vec4.create())
        }, {
          label: "blocks",
          buffer: { type: "storage" },
          resource: new DynamicBuffer(device, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC, CHUNK_SIZE ** 3, true)
        }]
      ]
    });
  }


  public dispatch(device: GPUDevice): void {
    this.buffers.params.write(vec4.create(3, 1, 6, CHUNK_SIZE));

    const readback = this.buffers.blocks.readback!;
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.getBindGroup(0));
    pass.dispatchWorkgroups(CHUNK_SIZE / WORKGROUP_SIZE[0], CHUNK_SIZE / WORKGROUP_SIZE[1], CHUNK_SIZE / WORKGROUP_SIZE[2]);
    pass.end();

    // Copy GPU output into readback buffer
    encoder.copyBufferToBuffer(this.buffers["blocks"].handle, readback);

    device.queue.submit([encoder.finish()]);

    readback.mapAsync(GPUMapMode.READ).then(() => {
      const mapped = readback.getMappedRange();
      const copy = mapped.slice(0);

      readback.unmap();

      console.log(new Float32Array(copy).slice(0, 20)); // TODO actually do something with it
    });
  }
}

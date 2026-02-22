import { DynamicBuffer } from "./classes/dynamic-buffer"

type BindGroupEntryDescriptor<S> = Omit<GPUBindGroupLayoutEntry, "binding" | "visibility"> & { label: S, resource: DynamicBuffer }

type ComputeKernelDescriptor<S> = {
  device: GPUDevice
  descriptor: GPUComputePipelineDescriptor
  groups: BindGroupEntryDescriptor<S>[][]
}

// Generic class that works for all compute shaders. Accepts the descriptor and buffers. Subclasses can then extend this class to add their own dispatch method.
export abstract class ComputeKernel<S extends string> {
  public pipeline: GPUComputePipeline
  public buffers: Record<S, DynamicBuffer> = {} as Record<S, DynamicBuffer>
  public bindgroups: GPUBindGroup[]
  private device: GPUDevice
  private groupDescriptors: ComputeKernelDescriptor<S>["groups"]

  public constructor(descriptor: ComputeKernelDescriptor<S>) {
    this.device = descriptor.device;
    this.groupDescriptors = descriptor.groups;
    this.pipeline = descriptor.device.createComputePipeline(descriptor.descriptor);

    for (const group of descriptor.groups) {
      for (const entry of group) {
        this.buffers[entry.label] = entry.resource;
      }
    }

    // Create initial bindgroups (kept for compatibility), but callers
    // should use `getBindGroup` to get a fresh bindgroup that references
    // current buffer handles in case buffers were recreated.
    this.bindgroups = descriptor.groups.map((groupdescriptor, groupindex) => {
      const layout = this.pipeline.getBindGroupLayout(groupindex);
      const entries = groupdescriptor.map((entrydescriptor, binding) => ({ binding, resource: entrydescriptor.resource.handle }));

      return descriptor.device.createBindGroup({ layout, entries });
    });
  }

  // Recreate and return a bindgroup using the current buffer handles.
  public getBindGroup(index: number): GPUBindGroup {
    const layout = this.pipeline.getBindGroupLayout(index);
    const groupdescriptor = this.groupDescriptors[index];
    const entries = groupdescriptor.map((entrydescriptor, binding) => ({ binding, resource: entrydescriptor.resource.handle }));

    return this.device.createBindGroup({ layout, entries });
  }

  public abstract dispatch(device: GPUDevice, encoder: GPUCommandEncoder, pass: GPUComputePassEncoder): void;
}

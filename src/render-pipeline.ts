import { DynamicBuffer } from "./classes/dynamic-buffer";
import { State } from "./state";

type PipelineDrawFunction = (
  pass: GPURenderPassEncoder,
  self: RenderPipeline,
  state: State,
) => void;

type EntryWrapper = {
  resource: DynamicBuffer | GPUBindingResource;
  update?: (state: State, buffer: DynamicBuffer) => void;
};

export type EntryDescriptor = Omit<GPUBindGroupLayoutEntry, "visibility" | "binding"> &
  EntryWrapper;

type GroupWrapper = {
  layout: GPUBindGroupLayout;
  group: GPUBindGroup;
  entries: EntryWrapper[];
};

export type RenderPipelineDescriptor = {
  device: GPUDevice;
  module: GPUShaderModule;
  descriptor: Omit<
    GPURenderPipelineDescriptor,
    "vertex" | "fragment" | "layout"
  > & {
    vertex: Omit<GPURenderPipelineDescriptor["vertex"], "module">;
    fragment: Omit<
      NonNullable<GPURenderPipelineDescriptor["fragment"]>,
      "module"
    >;
  };
  groups: EntryDescriptor[][];
  draw: PipelineDrawFunction;
};

export class RenderPipeline {
  public device: GPUDevice;
  public pipeline: GPURenderPipeline;
  public groups: GroupWrapper[];
  public draw: PipelineDrawFunction;

  constructor(descriptor: RenderPipelineDescriptor) {
    this.device = descriptor.device;
    this.draw = descriptor.draw;

    this.groups = descriptor.groups.map<GroupWrapper>((groupwrapper) => {
      const layout = this.device.createBindGroupLayout({
        entries: groupwrapper.map<GPUBindGroupLayoutEntry>((entry, i) => ({
          binding: i,
          visibility:
            GPUShaderStage.COMPUTE |
            GPUShaderStage.FRAGMENT |
            GPUShaderStage.VERTEX,
          buffer: entry.buffer,
          externalTexture: entry.externalTexture,
          sampler: entry.sampler,
          storageTexture: entry.storageTexture,
          texture: entry.texture,
        })),
      });

      const group = this.device.createBindGroup({
        layout,
        entries: groupwrapper.map<GPUBindGroupEntry>((entry, i) => ({
          binding: i,
          resource:
            entry.resource instanceof DynamicBuffer
              ? entry.resource.handle
              : entry.resource,
        })),
      });

      const entries = groupwrapper.map<EntryWrapper>((entry) => ({
        resource: entry.resource,
        update: entry.update,
      }));

      return { layout, group, entries };
    });

    this.pipeline = this.device.createRenderPipeline({
      ...descriptor.descriptor,
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: this.groups.map<GPUBindGroupLayout>((g) => g.layout),
      }),
      vertex: { ...descriptor.descriptor["vertex"], module: descriptor.module },
      fragment: {
        ...descriptor.descriptor["fragment"],
        module: descriptor.module,
      },
    });
  }

  public updateBinding(
    groupIndex: number,
    bindingIndex: number,
    resource: GPUBindingResource,
  ) {
    const group = this.groups[groupIndex];
    group.entries[bindingIndex].resource = resource;
    group.group = this.device.createBindGroup({
      layout: group.layout,
      entries: group.entries.map<GPUBindGroupEntry>((e, i) => ({
        binding: i,
        resource:
          e.resource instanceof DynamicBuffer ? e.resource.handle : e.resource,
      })),
    });
  }

  // Update all buffers/groups
  public update(state: State) {
    for (const groupwrapper of this.groups) {
      let update = false;

      // Let each DynamicBuffer update
      groupwrapper.entries.forEach((entrywrapper) => {
        if (!(entrywrapper.resource instanceof DynamicBuffer)) return;

        const before = entrywrapper.resource.handle;
        entrywrapper.update?.(state, entrywrapper.resource);
        const after = entrywrapper.resource.handle;

        if (before != after) update = true; // Handle (GPUBuffer) changed, update necessary
      });

      if (!update) continue; // Nothing changed

      // Update entries and group
      groupwrapper.group = this.device.createBindGroup({
        layout: groupwrapper.layout,
        entries: groupwrapper.entries.map<GPUBindGroupEntry>((e, i) => ({
          binding: i,
          resource:
            e.resource instanceof DynamicBuffer
              ? e.resource.handle
              : e.resource,
        })),
      });
    }
  }
}

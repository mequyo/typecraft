type Region = {
  start: number;
  size: number;
  blocks: FreeBlock[];
};

type FreeBlock = {
  start: number;
  size: number;
};

export type Allocation = Readonly<{
  region: number;
  start: number; // bytes
  size: number; // bytes (aligned)
  used: number;
}>;

const isPow2 = (x: number) => (x & (x - 1)) === 0 && x > 0;
const align = (x: number, a: number) => {
  if (!isPow2(a)) throw new Error(`Alignment must be power of 2, got ${a}`);
  return (x + a - 1) & ~(a - 1);
};
const alignUpMultiple = (x: number, m: number) => Math.ceil(x / m) * m;

export class ArenaBuffer {
  public readonly buffer: GPUBuffer;
  private readonly device: GPUDevice;
  //private readonly alignment: number;
  private regions: Region[] = [];
  private sizeBytes: number;

  /**
   * @param sizeBytes total arena size in bytes
   * @param usage GPUBufferUsage flags (must include COPY_DST)
   * @param alignment byte alignment for allocations (16 is good for vertices)
   */
  constructor(
    device: GPUDevice,
    sizeBytes: number,
    usage: GPUBufferUsageFlags,
    regions: number[],
    alignment: number = 16,
  ) {
    if ((usage & GPUBufferUsage.COPY_DST) === 0)
      throw new Error("Usage must include GPUBufferUsage.COPY_DST");
    if (!isPow2(alignment)) throw new Error("Alignment must be power of two");

    this.device = device;
    //this.alignment = alignment;
    this.sizeBytes = alignUpMultiple(align(sizeBytes, alignment), 8);
    this.buffer = device.createBuffer({ size: this.sizeBytes, usage });
    //this.freeBlocks = [{ start: 0, size: this.sizeBytes }];

    let offset = 0;
    for (let i = 0; i < regions.length; i++) {
      const regionSize = Math.floor((regions[i] * this.sizeBytes) / 8) * 8;
      this.regions[i] = {
        start: offset,
        size: regionSize,
        blocks: [{ start: 0, size: regionSize }],
      };
      offset += regionSize;
    }
  }

  /**
   * Uploads data and returns the allocation handle.
   */
  public write(region: number, data: ArrayBufferView): Allocation {
    const alloc = this.alloc(region, data.byteLength);

    this.device.queue.writeBuffer(
      this.buffer,
      alloc.start,
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );

    return alloc;
  }

  /**
   * Allocate space without writing.
   */
  public alloc(region: number, sizeBytes: number): Allocation {
    if (region < 0 || region >= this.regions.length)
      throw new Error(`Invalid region ${region}`);

    const bytes = alignUpMultiple(sizeBytes, 8);

    const reg = this.regions[region];

    // FIRST-FIT over this region's free list (blocks are relative to region.start)
    for (let i = 0; i < reg.blocks.length; i++) {
      const block = reg.blocks[i];

      if (block.size < bytes) continue;

      const offsetInRegion = block.start;
      block.start += bytes;
      block.size -= bytes;

      if (block.size === 0) reg.blocks.splice(i, 1);

      const absoluteOffset = reg.start + offsetInRegion;
      return { region, start: absoluteOffset, size: bytes, used: 0 };
    }

    console.warn(
      `ArenaBuffer.alloc failed for region ${region}: requested ${bytes} bytes, region capacity ${reg.size}`,
      reg.blocks.slice(0, 20),
    );
    throw new Error(
      `ArenaBuffer region ${region} out of space (requested ${bytes} bytes, region capacity ${reg.size})`,
    );
  }

  /**
   * Free an allocation immediately.
   * You must ensure the GPU is no longer reading this region.
   */
  public free(alloc: Allocation) {
    const reg = this.regions[alloc.region];
    if (!reg) throw new Error(`Invalid region ${alloc.region}`);

    const block: FreeBlock = {
      start: alloc.start - reg.start,
      size: alloc.size,
    };

    // Insert sorted by offset within the region
    let i = 0;
    while (i < reg.blocks.length && reg.blocks[i].start < block.start) i++;
    reg.blocks.splice(i, 0, block);

    // Merge with previous
    if (i > 0) {
      const prev = reg.blocks[i - 1];
      if (prev.start + prev.size === block.start) {
        prev.size += block.size;
        reg.blocks.splice(i, 1);
        i--;
      }
    }

    // Merge with next
    if (i + 1 < reg.blocks.length) {
      const cur = reg.blocks[i];
      const next = reg.blocks[i + 1];
      if (cur.start + cur.size === next.start) {
        cur.size += next.size;
        reg.blocks.splice(i + 1, 1);
      }
    }
  }

  /**
   * Debug info
   */
  public stats(): {
    capacityBytes: number;
    freeBytes: number;
    usedBytes: number;
  } {
    let freeBytes = 0;
    let freeBlocks = 0;
    for (const r of this.regions) {
      for (const b of r.blocks) {
        freeBytes += b.size;
        freeBlocks++;
      }
    }

    return {
      capacityBytes: this.sizeBytes,
      freeBytes,
      usedBytes: this.sizeBytes - freeBytes,
    };
  }
}

import { BUFFER_GROW_FACTOR, BUFFER_MIN_SIZE } from "../constants";

export class DynamicBuffer {
  public bytesUsed = 0; // Bytes currently in use (being drawn)
  private device: GPUDevice;
  public growFactor: number;
  public handle: GPUBuffer;
  private sizeBytes = 0; // Actual GPU buffer size in bytes
  private usage: GPUBufferUsageFlags;

  public constructor(options: {
    device: GPUDevice,
    usage: GPUBufferUsageFlags,
    data?: ArrayBufferView,
    sizeBytes?: number,
    growFactor?: number,
  }) {
    const { device, usage, data, sizeBytes, growFactor } = options;

    // Compute initial size in bytes (must be multiple of 4 for copies)
    const initialBytes = Math.max(BUFFER_MIN_SIZE, sizeBytes ?? 0, data?.byteLength ?? 0);
    const aligned = initialBytes + (4 - (initialBytes % 4));

    this.growFactor = growFactor ?? BUFFER_GROW_FACTOR;
    this.device = device;
    this.usage = usage;
    this.sizeBytes = Math.max(BUFFER_MIN_SIZE, aligned);
    this.handle = this.device.createBuffer({ size: this.sizeBytes, usage });

    if (data) this.write(data);
  }

  /**
   * Uploads data to the GPU buffer. Automatically grows or shrinks
   * depending on usage. Offsets are in bytes.
   */
  public write(data: ArrayBufferView, bufferoffset = 0): void {
    const bytes = data.byteLength;

    // Grow if too small or shrink if buffer is way too big for data
    if (
      !this.handle ||
      this.sizeBytes < bytes + bufferoffset
    ) {

      this.handle?.destroy();

      let newSize = Math.floor((bytes + bufferoffset) * this.growFactor);
      newSize = newSize + (4 - (newSize % 4));
      newSize = Math.max(newSize, BUFFER_MIN_SIZE);

      this.sizeBytes = newSize;
      this.handle = this.device.createBuffer({
        size: this.sizeBytes,
        usage: this.usage,
      });
    }

    // Write CPU data → GPU buffer
    this.bytesUsed = bytes;
    this.device.queue.writeBuffer(
      this.handle,
      bufferoffset,
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );
  }

  public destroy() {
    this.handle.destroy();
  }
}

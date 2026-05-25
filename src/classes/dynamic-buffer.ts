import {
  BUFFER_GROW_FACTOR,
  BUFFER_MIN_SIZE,
  BUFFER_SHRINK_THRESHOLD,
} from "../constants";

export class DynamicBuffer {
  private device: GPUDevice;
  public handle: GPUBuffer;
  private usage: GPUBufferUsageFlags;
  public capacity = 0; // Bytes currently in use (being drawn)
  public readback?: GPUBuffer;
  private sizeBytes = 0; // Actual GPU buffer size in bytes

  constructor(
    device: GPUDevice,
    usage: GPUBufferUsageFlags,
    dataOrSize?: ArrayBufferView | number,
    readback?: boolean,
  ) {
    // Compute initial size in bytes (must be multiple of 4 for copies)
    const initialBytes =
      dataOrSize == undefined
        ? BUFFER_MIN_SIZE
        : typeof dataOrSize == "number"
          ? dataOrSize
          : dataOrSize.byteLength;
    const aligned = initialBytes + ((4 - (initialBytes % 4)) % 4);

    this.device = device;
    this.usage = usage;
    this.sizeBytes = Math.max(BUFFER_MIN_SIZE, aligned);
    this.handle = this.device.createBuffer({ size: this.sizeBytes, usage });

    // Optionally create a same-sized readback buffer for GPU->CPU reads
    if (readback) {
      this.readback = this.device.createBuffer({
        size: this.sizeBytes,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
    }

    if (dataOrSize && typeof dataOrSize != "number") this.write(dataOrSize);
  }

  /**
   * Uploads data to the GPU buffer. Automatically grows or shrinks
   * depending on usage. Offsets are in bytes.
   */
  write(data: ArrayBufferView, bufferoffset = 0): void {
    const bytes = data.byteLength;

    // Grow if too small or shrink if buffer is way too big for data
    if (
      !this.handle ||
      this.sizeBytes < bytes + bufferoffset //||
      //(bufferoffset === 0 && this.sizeBytes * BUFFER_SHRINK_THRESHOLD > bytes)
    ) {
      const hadReadback = !!this.readback;

      this.handle?.destroy();
      this.readback?.destroy();

      let newSize = Math.floor((bytes + bufferoffset) * BUFFER_GROW_FACTOR);
      newSize = newSize + ((4 - (newSize % 4)) % 4);
      newSize = Math.max(newSize, BUFFER_MIN_SIZE);

      this.sizeBytes = newSize;
      this.handle = this.device.createBuffer({
        size: this.sizeBytes,
        usage: this.usage,
      });

      if (hadReadback) {
        this.readback = this.device.createBuffer({
          size: this.sizeBytes,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
      } else {
        this.readback = undefined;
      }
    }

    // Write CPU data → GPU buffer
    this.capacity = bytes;
    this.device.queue.writeBuffer(
      this.handle,
      bufferoffset,
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );
  }
}

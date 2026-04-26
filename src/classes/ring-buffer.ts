export class RingBuffer {
  private data: Float32Array;
  private elements = 0;
  private index = 0;
  public sum = 0;

  public constructor(size: number) {
    this.data = new Float32Array(size);
  }

  public push(...items: number[]) {
    for (let i = 0; i < items.length; i++) {
      const val = items[i];
      const old = this.data[this.index];

      if (this.elements < this.data.length) this.elements += 1;

      this.data[this.index] = val;
      this.index = (this.index + 1) % this.data.length;
      this.sum += val - old;
    }
  }

  public average() {
    return this.sum / this.elements;
  }

  public min(percent: number): number {
    if (percent < 1 || percent > 100) throw new Error("Percent must be between 1 and 100.");

    const sorted = this.data.slice(0, this.elements).sort();
    const count = Math.ceil(this.elements * percent / 100);

    let sum = 0;
    for (let i = 0; i < count; i++) sum += sorted[i];
    return sum / count;
  }

  public max(percent: number): number {
    if (percent < 1 || percent > 100) throw new Error("Percent must be between 1 and 100.");

    const sorted = this.data.slice(0, this.elements).sort((a, b) => b - a);
    const count = Math.ceil(this.elements * percent / 100);

    let sum = 0;
    for (let i = 0; i < count; i++) sum += sorted[i];
    return sum / count;
  }
}
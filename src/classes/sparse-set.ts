export class SparseSet<T> implements Iterable<T> {
  private indices: number[] = [];   // sparse
  private entities: number[] = [];  // dense
  public values: T[] = [];          // dense


  public has(e: number): boolean {
    const i = this.indices[e];
    return i !== undefined && this.entities[i] === e;
  }


  public get(e: number): T | undefined {
    if (!this.has(e)) return undefined;
    return this.values[this.indices[e]];
  }


  public add(e: number, value: T): void {
    if (this.has(e)) {
      this.values[this.indices[e]] = value;
      return;
    }

    const i = this.entities.length;
    this.indices[e] = i;
    this.entities.push(e);
    this.values.push(value);
  }


  public remove(e: number): void {
    if (!this.has(e)) return;

    const i = this.indices[e];
    const last = this.entities.length - 1;
    const lastE = this.entities[last];

    // swap-remove
    this.entities[i] = lastE;
    this.values[i] = this.values[last];
    this.indices[lastE] = i;

    this.entities.pop();
    this.values.pop();
    delete this.indices[e];
  }


  public get size(): number {
    return this.entities.length;
  }


  public [Symbol.iterator](): Iterator<T> {
    let i = 0;
    const values = this.values;

    return {
      next(): IteratorResult<T> {
        return { value: values[i++], done: i >= values.length };
      },
    };
  }
}
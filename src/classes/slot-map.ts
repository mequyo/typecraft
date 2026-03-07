export class SlotMap<K, T> {
  private indices = new Map<K, number>(); // Maps key -> index in entries
  private reverse = new Map<number, K>(); // Maps index in entries -> key for fast key retrieval
  public values: T[] = []; // Dense data array

  get(key: K): T | undefined {
    return this.values[this.indices.get(key) ?? -1] ?? undefined;
  }

  set(key: K, entry: T) {
    this.indices.set(key, this.values.length);
    this.reverse.set(this.values.length, key);
    this.values.push(entry);
  }

  delete(key: K): boolean {
    const index = this.indices.get(key);
    if (index === undefined) return false;

    const lastkey = this.reverse.get(this.values.length - 1);
    if (lastkey === undefined) return false;

    // Swap index with last element and pop for O(1) removal
    this.values[index] = this.values[this.values.length - 1];
    this.values.pop();
    this.indices.set(lastkey, index);
    this.reverse.set(index, lastkey);
    this.indices.delete(key);
    this.reverse.delete(index);

    return true;
  }

  get size(): number {
    return this.indices.size;
  }
}
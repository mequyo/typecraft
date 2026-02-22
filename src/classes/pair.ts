export class Pair<K, V> {
  private map: Map<K, Map<K, V>> = new Map();
  public size = 0;

  clear(): void {
    this.map.clear();
    this.size = 0;
  }

  delete(k1: K, k2: K): boolean {
    const layer2 = this.map.get(k1);
    if (!layer2) return false;

    const deleted = layer2.delete(k2);
    if (deleted) {
      this.size--;
      if (layer2.size === 0) this.map.delete(k1);
    }
    return deleted;
  }

  get(k1: K, k2: K): V | undefined {
    return this.map.get(k1)?.get(k2);
  }

  getOrDefault(k1: K, k2: K, def: V): V {
    return this.map.get(k1)?.get(k2) ?? def;
  }

  has(k1: K, k2: K): boolean {
    return this.map.get(k1)?.has(k2) ?? false;
  }

  set(k1: K, k2: K, value: V): this {
    let layer2 = this.map.get(k1);
    if (!layer2) {
      layer2 = new Map();
      this.map.set(k1, layer2);
    }

    if (!layer2.has(k2)) this.size++;
    layer2.set(k2, value);
    return this;
  }

  setIf(k1: K, k2: K, value: V, condition: (current: V) => boolean): this {
    let first = this.map.get(k1);

    if (!first) {
      first = new Map();
      this.map.set(k1, first);
    }

    const current = first.get(k2);

    if (current === undefined || condition(current)) {
      if (current === undefined) this.size++; // only increment size for a new key
      first.set(k2, value);
    }

    return this;
  }

  *keys(): IterableIterator<[K, K]> {
    for (const [k1, layer2] of this.map.entries()) {
      for (const k2 of layer2.keys()) {
        yield [k1, k2];
      }
    }
  }

  *values(): IterableIterator<V> {
    for (const layer2 of this.map.values()) {
      for (const v of layer2.values()) {
        yield v;
      }
    }
  }

  *entries(): IterableIterator<[[K, K], V]> {
    for (const [k1, layer2] of this.map.entries()) {
      for (const [k2, v] of layer2.entries()) {
        yield [[k1, k2], v];
      }
    }
  }

  *entriesOrdered(compareK1?: (a: K, b: K) => number, compareK2?: (a: K, b: K) => number): IterableIterator<[[K, K], V]> {
    const k1sorted = Array.from(this.map.keys()).sort(compareK1);
    for (const k1 of k1sorted) {

      const layer2 = this.map.get(k1);
      if (!layer2) continue;
      const k2sorted = Array.from(layer2.keys()).sort(compareK2);

      for (const k2 of k2sorted) {

        const v = this.get(k1, k2);
        if (!v) continue;

        yield [[k1, k2], v];
      }
    }
  }

  forEach(callback: (value: V, k1: K, k2: K) => void): void {
    for (const [k1, layer2] of this.map.entries()) {
      for (const [k2, v] of layer2.entries()) {
        callback(v, k1, k2);
      }
    }
  }
}

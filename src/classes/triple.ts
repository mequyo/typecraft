export class Triple<K, V> {
  private map: Map<K, Map<K, Map<K, V>>> = new Map();
  public size = 0;

  clear(): void {
    this.map.clear();
    this.size = 0;
  }

  delete(k1: K, k2: K, k3: K): boolean {
    const first = this.map.get(k1);
    if (!first) return false;
    const second = first.get(k2);
    if (!second) return false;

    const deleted = second.delete(k3);
    if (deleted) {
      this.size--;
      if (second.size === 0) first.delete(k2);
      if (first.size === 0) this.map.delete(k1);
    }
    return deleted;
  }

  get(k1: K, k2: K, k3: K): V | undefined {
    return this.map.get(k1)?.get(k2)?.get(k3);
  }

  getOrDefault(k1: K, k2: K, k3: K, def: V): V {
    return this.map.get(k1)?.get(k2)?.get(k3) ?? def;
  }

  has(k1: K, k2: K, k3: K): boolean {
    return this.map.get(k1)?.get(k2)?.has(k3) ?? false;
  }

  set(k1: K, k2: K, k3: K, value: V): this {
    let layer2 = this.map.get(k1);
    if (!layer2) {
      layer2 = new Map();
      this.map.set(k1, layer2);
    }

    let layer3 = layer2.get(k2);
    if (!layer3) {
      layer3 = new Map();
      layer2.set(k2, layer3);
    }

    if (!layer3.has(k3)) this.size++;
    layer3.set(k3, value);
    return this;
  }

  setIf(
    k1: K,
    k2: K,
    k3: K,
    value: V,
    condition: (current: V) => boolean,
  ): this {
    let layer2 = this.map.get(k1);
    if (!layer2) {
      layer2 = new Map();
      this.map.set(k1, layer2);
    }

    let layer3 = layer2.get(k2);
    if (!layer3) {
      layer3 = new Map();
      layer2.set(k2, layer3);
    }

    const current = layer3.get(k3);

    if (current === undefined || condition(current)) {
      if (current === undefined) this.size++; // only increment size for a new key
      layer3.set(k3, value);
    }

    return this;
  }

  *keys(): IterableIterator<[K, K, K]> {
    for (const [k1, layer2] of this.map.entries()) {
      for (const [k2, layer3] of layer2.entries()) {
        for (const k3 of layer3.keys()) {
          yield [k1, k2, k3];
        }
      }
    }
  }

  *values(): IterableIterator<V> {
    for (const layer2 of this.map.values()) {
      for (const layer3 of layer2.values()) {
        for (const v of layer3.values()) {
          yield v;
        }
      }
    }
  }

  *entries(): IterableIterator<[[K, K, K], V]> {
    for (const [k1, layer2] of this.map.entries()) {
      for (const [k2, layer3] of layer2.entries()) {
        for (const [k3, v] of layer3.entries()) {
          yield [[k1, k2, k3], v];
        }
      }
    }
  }

  *entriesOrdered(
    compareK1?: (a: K, b: K) => number,
    compareK2?: (a: K, b: K) => number,
    compareK3?: (a: K, b: K) => number,
  ): IterableIterator<[[K, K, K], V]> {
    const k1sorted = Array.from(this.map.keys()).sort(compareK1);
    for (const k1 of k1sorted) {
      const layer2 = this.map.get(k1);
      if (!layer2) continue;
      const k2sorted = Array.from(layer2.keys()).sort(compareK2);

      for (const k2 of k2sorted) {
        const layer3 = layer2.get(k2);
        if (!layer3) continue;
        const k3sorted = Array.from(layer3.keys()).sort(compareK3);

        for (const k3 of k3sorted) {
          const v = this.get(k1, k2, k3);
          if (!v) continue;

          yield [[k1, k2, k3], v];
        }
      }
    }
  }

  forEach(callback: (value: V, k1: K, k2: K, k3: K) => void): void {
    for (const [k1, layer2] of this.map.entries()) {
      for (const [k2, layer3] of layer2.entries()) {
        for (const [k3, v] of layer3.entries()) {
          callback(v, k1, k2, k3);
        }
      }
    }
  }
}

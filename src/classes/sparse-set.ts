type DataArray = { [key: number]: any; length: number };
type ExtractTuple<T extends DataArray[]> = {
  [K in keyof T]: T[K] extends { [key: number]: infer U } ? U : never;
};

/**
 * High-performance SparseSet implementation optimized for ECS-style workloads. Adds, removes and looks up in O(1).
 */
export class SparseSet<V extends DataArray[]> {
  private indices: Int32Array; // Sparse entity -> dense index table. Uses -1 as "not present"
  private entities: Int32Array; // Dense storage of entitys
  public values: V; // Storage for component data. Each index in this tuple represents one field of the component type
  private _size: number = 0; // Number of active entities in the set

  /**
   * Creates a new SparseSet.
   * @param capacity Maximum number of entities that can be stored.
   * @param init SoA storage buffers. For example: `new SparseSet(size, [new FloatArray(size), [] as number[]])`.
   */
  constructor(capacity: number, init: [...V]) {
    this.indices = new Int32Array(capacity).fill(-1);
    this.entities = new Int32Array(capacity);
    this.values = init;
  }

  /**
   * Checks if an entity exists in the set.
   * @param e Entity ID.
   * @returns true if entity is present.
   */
  public has(e: number): boolean {
    const i = this.indices[e];
    return i !== -1 && this.entities[i] === e;
  }

  /**
   * Gets the dense index position of an entity. Useful for direct buffer access.
   * @param e Entity ID.
   * @returns Dense index or -1 if not found.
   */
  public getIndex(e: number): number {
    const i = this.indices[e];
    return i !== -1 && this.entities[i] === e ? i : -1;
  }

  /**
   * Adds or updates an entity with component data. If the entity already exists, its data will be overwritten.
   * @param e Entity ID.
   * @param data Component field values. Tuple order must match storage layout.
   */
  public add(e: number, ...data: ExtractTuple<V>) {
    const existing = this.getIndex(e);
    const values = this.values;

    // Update existing
    if (existing !== -1) {
      for (let idx = 0; idx < values.length; idx++) {
        values[idx][existing] = data[idx];
      }
      return;
    }

    // Insert new
    const i = this._size++;

    this.indices[e] = i;
    this.entities[i] = e;

    for (let idx = 0; idx < values.length; idx++) {
      values[idx][i] = data[idx];
    }
  }

  /**
   * Removes an entity from the set using swap-remove in O(1). Maintains dense array compactness by swapping with the last element.
   * @param e Entity ID.
   * @returns true if an entity was removed.
   */
  public remove(e: number): boolean {
    const i = this.getIndex(e);
    if (i === -1) return false;

    const last = --this._size;
    const lastE = this.entities[last];
    const values = this.values;

    // Swap entity
    this.entities[i] = lastE;
    this.indices[lastE] = i;

    // Swap data in all buffers
    for (let idx = 0; idx < values.length; idx++) {
      const arr = values[idx];
      arr[i] = arr[last];
    }

    this.indices[e] = -1;
    return true;
  }

  /**
   * Returns the number of active entities in the set.
   */
  public get size(): number {
    return this._size;
  }
}

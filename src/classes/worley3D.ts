export class Worley3D {
  private seed: number;

  constructor(seed = 0) {
    this.seed = seed;
  }

  // Simple pseudo-random generator (deterministic for each cell)
  private hash(x: number, y: number, z: number): number {
    let h = x * 374761393 + y * 668265263 + z * 2147483647 + this.seed * 1013904223;
    h = (h ^ (h >> 13)) * 1274126177;
    return (h ^ (h >> 16)) >>> 0;
  }

  // Random float in [0, 1)
  private rand(x: number, y: number, z: number): number {
    return this.hash(x, y, z) / 0xffffffff;
  }

  /**
   * Classic 3D Worley noise
   * @param x World x-coordinate
   * @param y World y-coordinate
   * @param z World z-coordinate
   * @param cellSize Size of the grid cell (controls feature density)
   * @returns Distance to nearest feature point in range [0, sqrt(3)]
   */
  distance(x: number, y: number, z: number, cellSize = 16): number {
    // Cell coordinates
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);
    const cellZ = Math.floor(z / cellSize);

    let minDist = Infinity;

    // Check surrounding 3x3x3 cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const cx = cellX + dx;
          const cy = cellY + dy;
          const cz = cellZ + dz;

          // Random feature point inside the neighbor cell
          const fx = cx * cellSize + this.rand(cx, cy, cz) * cellSize;
          const fy = cy * cellSize + this.rand(cx + 1, cy, cz) * cellSize;
          const fz = cz * cellSize + this.rand(cx, cy, cz + 1) * cellSize;

          // Distance to feature point
          const dist = Math.sqrt((x - fx) ** 2 + (y - fy) ** 2 + (z - fz) ** 2);
          if (dist < minDist) minDist = dist;
        }
      }
    }

    return minDist / (cellSize * Math.sqrt(3)); // normalize to [0, 1]
  }

  noise(x: number, y: number, z: number, cellsize: number): number {
    const f1 = this.distance(x, y, z, cellsize);
    return 1.0 - Math.min(1, Math.max(f1, 0));
  }
}

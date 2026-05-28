export class Simplex2D {
  private perm: Uint8Array;
  private skew: number;
  private unskew: number;
  private gradient: number[][];

  constructor(seed: number) {
    const perm = new Uint8Array(512);
    const p = new Uint8Array(256);

    // simple LCG
    let s = Math.floor(seed * 65536) & 0xffffffff;
    const rand = () =>
      (s = (s * 1664525 + 1013904223) & 0xffffffff) / 0xffffffff;

    for (let i = 0; i < 256; i++) p[i] = i;

    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }

    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

    this.perm = perm;

    // Gradients for 2D simplex
    this.gradient = [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [Math.SQRT1_2, Math.SQRT1_2],
      [-Math.SQRT1_2, Math.SQRT1_2],
      [Math.SQRT1_2, -Math.SQRT1_2],
      [-Math.SQRT1_2, -Math.SQRT1_2],
    ];

    // Skewing/unskewing factors for 2D
    this.skew = 0.5 * (Math.sqrt(3) - 1);
    this.unskew = (3 - Math.sqrt(3)) / 6;
  }

  /**
   * Generates 2D simplex noise for the given coordinates.
   *
   * The function first skews the input coordinates into simplex space,
   * determines the enclosing simplex triangle, and computes the noise
   * contribution from its three corners using precomputed gradient directions.
   *
   * @param x X coordinate in 2D space.
   * @param y Y coordinate in 2D space.
   * @returns A deterministic noise value in the range [0, 1].
   */
  noise(x: number, y: number): number {
    const s = (x + y) * this.skew;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * this.unskew;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    let i1, j1;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + this.unskew;
    const y1 = y0 - j1 + this.unskew;
    const x2 = x0 - 1 + 2 * this.unskew;
    const y2 = y0 - 1 + 2 * this.unskew;

    const ii = i & 255;
    const jj = j & 255;
    const g0 = this.gradient[this.perm[ii + this.perm[jj]] % 8];
    const g1 = this.gradient[this.perm[ii + i1 + this.perm[jj + j1]] % 8];
    const g2 = this.gradient[this.perm[ii + 1 + this.perm[jj + 1]] % 8];

    let n0 = 0,
      n1 = 0,
      n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * (g0[0] * x0 + g0[1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * (g1[0] * x1 + g1[1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * (g2[0] * x2 + g2[1] * y2);
    }

    return ((n0 + n1 + n2) * 70) / 2 + 0.5; // Scale result to [0, 1]
  }
}

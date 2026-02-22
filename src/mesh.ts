import { mat3, Mat3, Vec3, vec3 } from "wgpu-matrix";
import { CHUNK_SIZE, FLOATS_PER_VERTEX, RENDER_DISTANCE } from "./constants";



export enum FACE { PX = 0, NX = 1, PY = 2, NY = 3, PZ = 4, NZ = 5 }
export enum ROTATION { ZERO = 0, NINETY = 1, ONEEIGHTY = 2, TWOSEVENTY = 3 }
export enum ORIENTATION {
  PX_0, PX_90, PX_180, PX_270,
  NX_0, NX_90, NX_180, NX_270,
  PY_0, PY_90, PY_180, PY_270,
  NY_0, NY_90, NY_180, NY_270,
  PZ_0, PZ_90, PZ_180, PZ_270,
  NZ_0, NZ_90, NZ_180, NZ_270,
}

export const ROTATION_MATRICES = [
  mat3.create(1, 0, 0, 0, 1, 0, 0, 0, 1),   //   0° Z axis rotation 
  mat3.create(0, 1, 0, -1, 0, 0, 0, 0, 1),  //  90° Z axis rotation 
  mat3.create(-1, 0, 0, 0, -1, 0, 0, 0, 1), // 180° Z axis rotation
  mat3.create(0, -1, 0, 1, 0, 0, 0, 0, 1),  // 270° Z axis rotation
];

export const FACE_MATRICES = [
  mat3.create(0, 0, 1, 0, 1, 0, -1, 0, 0),  // PX
  mat3.create(0, 0, -1, 0, 1, 0, 1, 0, 0),  // NX
  mat3.create(1, 0, 0, 0, 0, 1, 0, -1, 0),  // PY
  mat3.create(1, 0, 0, 0, 0, -1, 0, 1, 0),  // NY
  mat3.create(1, 0, 0, 0, 1, 0, 0, 0, 1),   // PZ
  mat3.create(-1, 0, 0, 0, 1, 0, 0, 0, -1), // NZ
];

export const FACE_NORMALS = [
  vec3.create(+1, +0, +0),  // PX
  vec3.create(-1, +0, +0),  // NX
  vec3.create(+0, +1, +0),  // PY
  vec3.create(+0, -1, +0),  // NY
  vec3.create(+0, +0, +1),  // PZ
  vec3.create(+0, +0, -1),  // NZ
];

export const FACE_OPPOSITE_BIT = [
  1 << FACE.NX,
  1 << FACE.PX,
  1 << FACE.NY,
  1 << FACE.PY,
  1 << FACE.NZ,
  1 << FACE.PZ,
]

/* Returns the rotation matrix for a given orientation */
/* 24 orientations -> matrix for each */
export const ORIENTATION_MATRICES: Mat3[] = (() => {
  const out = new Array<Mat3>(24);
  for (let face = 0; face < 6; face++) {
    for (let rot = 0; rot < 4; rot++) {
      out[face * 4 + rot] = mat3.multiply(FACE_MATRICES[face], ROTATION_MATRICES[rot]);
    }
  }
  return out;
})();

/* Maps an orientation plus facing direction into the world facing direction */
/* [orientation, initial face] -> face (real world) */
/* number[24][6] */
export const ORIENTATION_FACE_MAP: number[][] = (() => {
  const out: number[][] = new Array(24);
  for (let o = 0; o < 24; o++) {
    out[o] = new Array(6);
    for (let world = 0; world < 6; world++) {
      const wn = FACE_NORMALS[world];
      let best = 0;
      let bestDot = -Infinity;
      for (let local = 0; local < 6; local++) {
        const t = vec3.transformMat3(vec3.create(FACE_NORMALS[local][0], FACE_NORMALS[local][1], FACE_NORMALS[local][2]), ORIENTATION_MATRICES[o]);
        const dot = t[0] * wn[0] + t[1] * wn[1] + t[2] * wn[2];
        if (dot > bestDot) { bestDot = dot; best = local; }
      }
      out[o][world] = best;
    }
  }
  return out;
})();


// Generates a list of coordinates (a sphere) and sorts it by distance to load chunks around the player in distance order
export const SPHERE_OFFSETS: Vec3[] = (() => {
  const offsets: [number, number, number, number][] = [];
  const r2 = RENDER_DISTANCE * RENDER_DISTANCE;

  for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
    for (let y = -3; y <= 3; y++) {
      for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
        const d2 = x * x + y * y + z * z;
        if (d2 <= r2) {
          offsets.push([x, y, z, d2]);
        }
      }
    }
  }

  offsets.sort((a, b) => a[3] - b[3]); // Sort by distance

  return offsets.map(o => vec3.create(o[0], o[1], o[2]));
})();


export class Mesh {
  public readonly bakedFaces: Float32Array[][] = []; // [orientation][face] -> Mesh
  public readonly cullingmasks: Uint8Array = new Uint8Array(24); // Returns the culling mask (e.g. 0b010010) for a given orientation

  constructor(cullingmask: number, base: [Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array]) {
    for (let orientation = 0; orientation < 24; orientation++) {
      const matrix = ORIENTATION_MATRICES[orientation];
      this.bakedFaces[orientation] = [];
      this.cullingmasks[orientation] = this.rotateCullingMask(cullingmask, matrix);

      for (let face = 0; face < 6; face++) {
        const mesh = this.rotateMesh(base[face], matrix);
        const worldface = ORIENTATION_FACE_MAP[orientation].findIndex(l => l === face);

        this.bakedFaces[orientation][worldface] = new Float32Array(mesh);
      }
    }
  }

  private rotateCullingMask(originalMask: number, matrix: Mat3): number {
    let rotated = 0;
    let scratch = vec3.create();

    for (let face = 0; face < 6; face += 1) {
      if ((originalMask & (1 << face)) == 0) continue; // Mask is 0 (non-covering) for this face, skip

      const normal = FACE_NORMALS[face];

      scratch = vec3.transformMat3(normal, matrix);

      const newFace = this.getFaceFromVector(scratch[0], scratch[1], scratch[2]);

      rotated |= 1 << newFace;
    }

    return rotated;
  }

  // Helper to identify direction from normal vector
  private getFaceFromVector(nx: number, ny: number, nz: number): FACE {
    const EPS = 0.8;
    if (nx > EPS) return FACE.PX;
    if (nx < -EPS) return FACE.NX;
    if (ny > EPS) return FACE.PY;
    if (ny < -EPS) return FACE.NY;
    if (nz > EPS) return FACE.PZ;
    if (nz < -EPS) return FACE.NZ;
    throw new Error("Given vector has no cardinal direction!")
  }

  public writeFace(buf: Uint32Array, offset: number, x: number, y: number, z: number, texture: number, face: FACE, orientation: number): number {
    const start = offset;
    const geometry = this.bakedFaces[orientation][face];

    // Mesh: [x, y, z, u, v, texture] -> [packed xyzt, packed uv]
    for (let vertex = 0; vertex < geometry.length; vertex += FLOATS_PER_VERTEX) {

      // world coordinates normalized to [0, 32] plus texture (10 bits)
      const lx = (4 * (geometry[vertex + 0] + x)) & 511;
      const ly = (4 * (geometry[vertex + 1] + y)) & 511;
      const lz = (4 * (geometry[vertex + 2] + z)) & 511;

      const u8 = Math.min(255, Math.max(0, Math.round(geometry[vertex + 3] * 255)));
      const v8 = Math.min(255, Math.max(0, Math.round(geometry[vertex + 4] * 255)));

      // [5 bits x, 5 bits y, 5 bits, z, 10 bits texture, ...]
      buf[offset++] = (lx << 18) | (ly << 9) | (lz << 0);
      buf[offset++] = (texture & 65535) << 16 | (v8 << 8) | (u8 << 0);
    }

    return offset - start;
  }

  public getFullMesh(x: number, y: number, z: number, normals: boolean, uv: boolean, texture: undefined | number, orientation: number): Float32Array {
    const buf: number[] = [];

    let offset = 0;
    for (let face = 0; face < 6; face += 1) {
      const geometry = this.bakedFaces[orientation][face];

      for (let v = 0; v < geometry.length; v += FLOATS_PER_VERTEX) {
        buf[offset++] = geometry[v + 0] + x;
        buf[offset++] = geometry[v + 1] + y;
        buf[offset++] = geometry[v + 2] + z;
        buf[offset++] = -1;
      }
    }

    return new Float32Array(buf);
  }

  private rotateMesh(src: Float32Array, m: Mat3): Float32Array {
    const out = new Float32Array(src.length);
    const c = 0.5;

    let p = vec3.create();

    for (let i = 0; i < src.length; i += FLOATS_PER_VERTEX) {
      // position
      p = vec3.set(
        src[i + 0] - c,
        src[i + 1] - c,
        src[i + 2] - c,
      );
      p = vec3.transformMat3(p, m);

      out[i + 0] = p[0] + c;
      out[i + 1] = p[1] + c;
      out[i + 2] = p[2] + c;

      // NEW leave out normals
      out[i + 3] = src[i + 3];
      out[i + 4] = src[i + 4];
      out[i + 5] = src[i + 5];
    }

    return out;
  }
}




// PX = 0, NX = 1, PY = 2, NY = 3, PZ = 4, NZ = 5
const CUBE_MESH: Mesh = new Mesh(
  0b111111,
  [
    new Float32Array([
      //  x  y  z  u  v  t
      1, 0, 0, 1, 1, 0,
      1, 1, 0, 1, 0, 0,
      1, 1, 1, 0, 0, 0,
      1, 0, 0, 1, 1, 0,
      1, 1, 1, 0, 0, 0,
      1, 0, 1, 0, 1, 0,
    ]),
    new Float32Array([
      0, 0, 1, 1, 1, 0,
      0, 1, 1, 1, 0, 0,
      0, 1, 0, 0, 0, 0,
      0, 0, 1, 1, 1, 0,
      0, 1, 0, 0, 0, 0,
      0, 0, 0, 0, 1, 0,
    ]),
    new Float32Array([
      0, 1, 0, 0, 1, 0,
      0, 1, 1, 0, 0, 0,
      1, 1, 1, 1, 0, 0,
      0, 1, 0, 0, 1, 0,
      1, 1, 1, 1, 0, 0,
      1, 1, 0, 1, 1, 0,
    ]),
    new Float32Array([
      0, 0, 1, 0, 1, 0,
      0, 0, 0, 0, 0, 0,
      1, 0, 0, 1, 0, 0,
      0, 0, 1, 0, 1, 0,
      1, 0, 0, 1, 0, 0,
      1, 0, 1, 1, 1, 0,
    ]),
    new Float32Array([
      0, 0, 1, 0, 1, 0,
      1, 0, 1, 1, 1, 0,
      1, 1, 1, 1, 0, 0,
      0, 0, 1, 0, 1, 0,
      1, 1, 1, 1, 0, 0,
      0, 1, 1, 0, 0, 0,
    ]),
    new Float32Array([
      1, 0, 0, 0, 1, 0,
      0, 0, 0, 1, 1, 0,
      0, 1, 0, 1, 0, 0,
      1, 0, 0, 0, 1, 0,
      0, 1, 0, 1, 0, 0,
      1, 1, 0, 0, 0, 0,
    ])
  ]
);

const FENCE_MESH = new Mesh(
  0b000000,
  [
    new Float32Array([
      //  x  y  z  n  n  n  u  v  t
      0.625, 0, 0.375, 0.25, 1.00, 0,
      0.625, 1, 0.375, 0.25, 0.00, 0,
      0.625, 1, 0.625, 0.00, 0.00, 0,
      0.625, 0, 0.375, 0.25, 1.00, 0,
      0.625, 1, 0.625, 0.00, 0.00, 0,
      0.625, 0, 0.625, 0.00, 1.00, 0,
    ]),
    new Float32Array([
      0.375, 0, 0.625, 0.25, 1.00, 0,
      0.375, 1, 0.625, 0.25, 0.00, 0,
      0.375, 1, 0.375, 0.00, 0.00, 0,
      0.375, 0, 0.625, 0.25, 1.00, 0,
      0.375, 1, 0.375, 0.00, 0.00, 0,
      0.375, 0, 0.375, 0.00, 1.00, 0,
    ]),
    new Float32Array([
      0.375, 1, 0.375, 0.00, 0.25, 0,
      0.375, 1, 0.625, 0.00, 0.00, 0,
      0.625, 1, 0.625, 0.25, 0.00, 0,
      0.375, 1, 0.375, 0.00, 0.25, 0,
      0.625, 1, 0.625, 0.25, 0.00, 0,
      0.625, 1, 0.375, 0.25, 0.25, 0,
    ]),
    new Float32Array([
      0.375, 0, 0.625, 0.00, 0.25, 0,
      0.375, 0, 0.375, 0.00, 0.00, 0,
      0.625, 0, 0.375, 0.25, 0.00, 0,
      0.375, 0, 0.625, 0.00, 0.25, 0,
      0.625, 0, 0.375, 0.25, 0.00, 0,
      0.625, 0, 0.625, 0.25, 0.25, 0,
    ]),
    new Float32Array([
      0.375, 0, 0.625, 0.00, 1.00, 0,
      0.625, 0, 0.625, 0.25, 1.00, 0,
      0.625, 1, 0.625, 0.25, 0.00, 0,
      0.375, 0, 0.625, 0.00, 1.00, 0,
      0.625, 1, 0.625, 0.25, 0.00, 0,
      0.375, 1, 0.625, 0.00, 0.00, 0,
    ]),
    new Float32Array([
      0.625, 0, 0.375, 0.00, 1.00, 0,
      0.375, 0, 0.375, 0.25, 1.00, 0,
      0.375, 1, 0.375, 0.25, 0.00, 0,
      0.625, 0, 0.375, 0.00, 1.00, 0,
      0.375, 1, 0.375, 0.25, 0.00, 0,
      0.625, 1, 0.375, 0.00, 0.00, 0,
    ])
  ]
);

const SLAB_MESH: Mesh = new Mesh(
  0b001000, // only occludes bottom
  [
    new Float32Array([
      //  x  y  z  n  n  n  u  v  t
      1.0, 0.0, 0, 1, 0.5, 0,
      1.0, 0.5, 0, 1, 0.0, 0,
      1.0, 0.5, 1, 0, 0.0, 0,
      1.0, 0.0, 0, 1, 0.5, 0,
      1.0, 0.5, 1, 0, 0.0, 0,
      1.0, 0.0, 1, 0, 0.5, 0,
    ]),
    new Float32Array([
      0.0, 0.0, 1, 1, 0.5, 0,
      0.0, 0.5, 1, 1, 0.0, 0,
      0.0, 0.5, 0, 0, 0.0, 0,
      0.0, 0.0, 1, 1, 0.5, 0,
      0.0, 0.5, 0, 0, 0.0, 0,
      0.0, 0.0, 0, 0, 0.5, 0,
    ]),
    new Float32Array([
      0, 0.5, 0, 0, 1, 0,
      0, 0.5, 1, 0, 0, 0,
      1, 0.5, 1, 1, 0, 0,
      0, 0.5, 0, 0, 1, 0,
      1, 0.5, 1, 1, 0, 0,
      1, 0.5, 0, 1, 1, 0,
    ]),
    new Float32Array([
      0, 0, 1, 0, 1, 0,
      0, 0, 0, 0, 0, 0,
      1, 0, 0, 1, 0, 0,
      0, 0, 1, 0, 1, 0,
      1, 0, 0, 1, 0, 0,
      1, 0, 1, 1, 1, 0,
    ]),
    new Float32Array([
      0.0, 0.0, 1, 0, 0.5, 0,
      1.0, 0.0, 1, 1, 0.5, 0,
      1.0, 0.5, 1, 1, 0.0, 0,
      0.0, 0.0, 1, 0, 0.5, 0,
      1.0, 0.5, 1, 1, 0.0, 0,
      0.0, 0.5, 1, 0, 0.0, 0,
    ]),
    new Float32Array([
      1.0, 0.0, 0, 0, 0.5, 0,
      0.0, 0.0, 0, 1, 0.5, 0,
      0.0, 0.5, 0, 1, 0.0, 0,
      1.0, 0.0, 0, 0, 0.5, 0,
      0.0, 0.5, 0, 1, 0.0, 0,
      1.0, 0.5, 0, 0, 0.0, 0,
    ])
  ]
);

const OPAQUE_CUBE_MESH: Mesh = new Mesh(
  0b000000,
  [
    new Float32Array([
      //  x  y  z  n  n  n  u  v  t
      1, 0, 0, 1, 1, 0,
      1, 1, 0, 1, 0, 0,
      1, 1, 1, 0, 0, 0,
      1, 0, 0, 1, 1, 0,
      1, 1, 1, 0, 0, 0,
      1, 0, 1, 0, 1, 0,
    ]),
    new Float32Array([
      0, 0, 1, 1, 1, 0,
      0, 1, 1, 1, 0, 0,
      0, 1, 0, 0, 0, 0,
      0, 0, 1, 1, 1, 0,
      0, 1, 0, 0, 0, 0,
      0, 0, 0, 0, 1, 0,
    ]),
    new Float32Array([
      0, 1, 0, 0, 1, 0,
      0, 1, 1, 0, 0, 0,
      1, 1, 1, 1, 0, 0,
      0, 1, 0, 0, 1, 0,
      1, 1, 1, 1, 0, 0,
      1, 1, 0, 1, 1, 0,
    ]),
    new Float32Array([
      0, 0, 1, 0, 1, 0,
      0, 0, 0, 0, 0, 0,
      1, 0, 0, 1, 0, 0,
      0, 0, 1, 0, 1, 0,
      1, 0, 0, 1, 0, 0,
      1, 0, 1, 1, 1, 0,
    ]),
    new Float32Array([
      0, 0, 1, 0, 1, 0,
      1, 0, 1, 1, 1, 0,
      1, 1, 1, 1, 0, 0,
      0, 0, 1, 0, 1, 0,
      1, 1, 1, 1, 0, 0,
      0, 1, 1, 0, 0, 0,
    ]),
    new Float32Array([
      1, 0, 0, 0, 1, 0,
      0, 0, 0, 1, 1, 0,
      0, 1, 0, 1, 0, 0,
      1, 0, 0, 0, 1, 0,
      0, 1, 0, 1, 0, 0,
      1, 1, 0, 0, 0, 0,
    ])
  ]
);

export type MeshID = number;
export const MESHES = [CUBE_MESH, FENCE_MESH, SLAB_MESH, OPAQUE_CUBE_MESH] as const;
export const MESH: Record<"CUBE" | "FENCE" | "SLAB" | "OPAQUE_CUBE", MeshID> = {
  CUBE: 0,
  FENCE: 1,
  SLAB: 2,
  OPAQUE_CUBE: 3,
}
export type MESH = typeof MESH[keyof typeof MESH]
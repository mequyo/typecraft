import { mat3, Mat3, Vec2, Vec3, vec3 } from "wgpu-matrix";
import { FLOATS_PER_VERTEX } from "./constants";
import { Sixtuple } from "./types";
import { Block } from "./registries/block-registry";

export enum FACE {
  PX = 0,
  NX = 1,
  PY = 2,
  NY = 3,
  PZ = 4,
  NZ = 5,
}
export enum ROTATION {
  ZERO = 0,
  NINETY = 1,
  ONEEIGHTY = 2,
  TWOSEVENTY = 3,
}
export enum ORIENTATION {
  PX_0,
  PX_90,
  PX_180,
  PX_270,
  NX_0,
  NX_90,
  NX_180,
  NX_270,
  PY_0,
  PY_90,
  PY_180,
  PY_270,
  NY_0,
  NY_90,
  NY_180,
  NY_270,
  PZ_0,
  PZ_90,
  PZ_180,
  PZ_270,
  NZ_0,
  NZ_90,
  NZ_180,
  NZ_270,
}

interface EdgeInfo {
  p1: Vec3;
  p2: Vec3;
  faceIndices: number[]; // Which world-space faces share this edge
}

const NORMALS_TO_ORIENTATION = [
  [9, 23, 13, 17],
  [11, 21, 15, 19],
  [22, 2, 18, 6],
  [20, 0, 16, 4],
  [10, 1, 12, 7],
  [8, 3, 14, 5],
];

export function UV_TO_ROTATION(uv: Vec2): ROTATION {
  const du = uv[0] - 0.5;
  const dv = uv[1] - 0.5;

  if (Math.abs(du) > Math.abs(dv)) {
    return du > 0 ? ROTATION.NINETY : ROTATION.TWOSEVENTY;
  } else {
    return dv > 0 ? ROTATION.ZERO : ROTATION.ONEEIGHTY;
  }
}

export function NORMAL_TO_ORIENTATION(normal: Vec3, uv: Vec2): ORIENTATION {
  const rotation = UV_TO_ROTATION(uv);

  if (normal[0] > 0.5) return NORMALS_TO_ORIENTATION[0][rotation];
  if (normal[0] < -0.5) return NORMALS_TO_ORIENTATION[1][rotation];
  if (normal[1] > 0.5) return NORMALS_TO_ORIENTATION[2][rotation];
  if (normal[1] < -0.5) return NORMALS_TO_ORIENTATION[3][rotation];
  if (normal[2] > 0.5) return NORMALS_TO_ORIENTATION[4][rotation];
  if (normal[2] < -0.5) return NORMALS_TO_ORIENTATION[5][rotation];

  return ORIENTATION.PX_0; // Fallback
}

export const ROTATION_MATRICES = [
  mat3.create(1, 0, 0, 0, 1, 0, 0, 0, 1), //   0° Z axis rotation
  mat3.create(0, 1, 0, -1, 0, 0, 0, 0, 1), //  90° Z axis rotation
  mat3.create(-1, 0, 0, 0, -1, 0, 0, 0, 1), // 180° Z axis rotation
  mat3.create(0, -1, 0, 1, 0, 0, 0, 0, 1), // 270° Z axis rotation
];

export const FACE_MATRICES = [
  mat3.create(0, 0, 1, 0, 1, 0, -1, 0, 0), // PX
  mat3.create(0, 0, -1, 0, 1, 0, 1, 0, 0), // NX
  mat3.create(1, 0, 0, 0, 0, 1, 0, -1, 0), // PY
  mat3.create(1, 0, 0, 0, 0, -1, 0, 1, 0), // NY
  mat3.create(1, 0, 0, 0, 1, 0, 0, 0, 1), // PZ
  mat3.create(-1, 0, 0, 0, 1, 0, 0, 0, -1), // NZ
];

export const FACE_NORMALS = [
  vec3.create(+1, +0, +0), // PX
  vec3.create(-1, +0, +0), // NX
  vec3.create(+0, +1, +0), // PY
  vec3.create(+0, -1, +0), // NY
  vec3.create(+0, +0, +1), // PZ
  vec3.create(+0, +0, -1), // NZ
];

export const FACE_OPPOSITE_BIT = [
  1 << FACE.NX,
  1 << FACE.PX,
  1 << FACE.NY,
  1 << FACE.PY,
  1 << FACE.NZ,
  1 << FACE.PZ,
];

/* Returns the rotation matrix for a given orientation */
/* 24 orientations -> matrix for each */
export const ORIENTATION_MATRICES: Mat3[] = (() => {
  const out = new Array<Mat3>(24);
  for (let face = 0; face < 6; face++) {
    for (let rot = 0; rot < 4; rot++) {
      out[face * 4 + rot] = mat3.multiply(
        FACE_MATRICES[face],
        ROTATION_MATRICES[rot],
      );
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
        const t = vec3.transformMat3(
          vec3.create(
            FACE_NORMALS[local][0],
            FACE_NORMALS[local][1],
            FACE_NORMALS[local][2],
          ),
          ORIENTATION_MATRICES[o],
        );
        const dot = t[0] * wn[0] + t[1] * wn[1] + t[2] * wn[2];
        if (dot > bestDot) {
          bestDot = dot;
          best = local;
        }
      }
      out[o][world] = best;
    }
  }
  return out;
})();

// Generates a list of coordinates (a sphere) and sorts it by distance to load chunks around the player in distance order

export function calculateSphereOffsets(radius: number): Vec3[] {
  const offsets: [number, number, number, number][] = [];
  const r2 = radius * radius;

  for (let x = -radius; x <= radius; x++) {
    for (let y = -3; y <= 3; y++) {
      for (let z = -radius; z <= radius; z++) {
        const d2 = x * x + y * y + z * z;
        if (d2 <= r2) {
          offsets.push([x, y, z, d2]);
        }
      }
    }
  }

  offsets.sort((a, b) => a[3] - b[3]); // Sort by distance

  return offsets.map((o) => vec3.create(o[0], o[1], o[2]));
}

export class Mesh {
  public readonly bakedFaces: Float32Array[][] = []; // [orientation][face] -> Mesh
  public readonly cullingmasks: Uint8Array = new Uint8Array(24); // Returns the culling mask (e.g. 0b010010) for a given orientation
  private readonly edgeConnectivity: EdgeInfo[][] = new Array(24);

  constructor(cullingmask: number, base: Sixtuple<Float32Array>) {
    for (let orientation = 0; orientation < 24; orientation++) {
      const matrix = ORIENTATION_MATRICES[orientation];
      this.bakedFaces[orientation] = [];
      this.cullingmasks[orientation] = this.rotateCullingMask(
        cullingmask,
        matrix,
      );

      for (let face = 0; face < 6; face++) {
        const mesh = this.rotateMesh(base[face], matrix);
        const worldface = ORIENTATION_FACE_MAP[orientation].findIndex(
          (l) => l === face,
        );

        this.bakedFaces[orientation][worldface] = new Float32Array(mesh);
      }

      this.edgeConnectivity[orientation] = this.precomputeEdges(orientation);
    }
  }

  private precomputeEdges(orientation: number): EdgeInfo[] {
    const edgeMap = new Map<string, EdgeInfo>();

    for (let face = 0; face < 6; face++) {
      const geometry = this.bakedFaces[orientation][face];
      if (!geometry || geometry.length === 0) continue;

      // Iterate triangles (assuming Triangle List topology)
      for (let v = 0; v < geometry.length; v += 3 * 6) {
        // 3 vertices * 6 floats per vertex
        const p = [
          vec3.create(geometry[v + 0], geometry[v + 1], geometry[v + 2]),
          vec3.create(geometry[v + 6], geometry[v + 7], geometry[v + 8]),
          vec3.create(geometry[v + 12], geometry[v + 13], geometry[v + 14]),
        ];

        // Check 3 edges of the triangle: (0,1), (1,2), (2,0)
        for (let i = 0; i < 3; i++) {
          const p1 = p[i];
          const p2 = p[(i + 1) % 3];

          // Create a unique key regardless of point order
          const key = this.getEdgeKey(p1, p2);

          if (!edgeMap.has(key)) {
            edgeMap.set(key, { p1, p2, faceIndices: [face] });
          } else {
            const info = edgeMap.get(key)!;
            if (!info.faceIndices.includes(face)) {
              info.faceIndices.push(face);
            }
          }
        }
      }
    }

    return Array.from(edgeMap.values());
  }

  private getEdgeKey(p1: Vec3, p2: Vec3): string {
    // Round to avoid floating point jitter in keys
    const pts = [p1, p2].sort(
      (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2],
    );
    return `${pts[0][0].toFixed(3)},${pts[0][1].toFixed(3)},${pts[0][2].toFixed(3)}|${pts[1][0].toFixed(3)},${pts[1][1].toFixed(3)},${pts[1][2].toFixed(3)}`;
  }

  private rotateCullingMask(originalMask: number, matrix: Mat3): number {
    let rotated = 0;
    let scratch = vec3.create();

    for (let face = 0; face < 6; face += 1) {
      if ((originalMask & (1 << face)) == 0) continue; // Mask is 0 (non-covering) for this face, skip

      const normal = FACE_NORMALS[face];

      scratch = vec3.transformMat3(normal, matrix);

      const newFace = this.getFaceFromVector(
        scratch[0],
        scratch[1],
        scratch[2],
      );

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
    throw new Error("Given vector has no cardinal direction!");
  }

  public writeFace(
    buf: Uint32Array,
    offset: number,
    x: number,
    y: number,
    z: number,
    texture: number,
    face: FACE,
    orientation: number,
  ): number {
    const start = offset;
    const geometry = this.bakedFaces[orientation][face];

    // Mesh: [x, y, z, u, v, texture] -> [packed xyzt, packed uv]
    for (
      let vertex = 0;
      vertex < geometry.length;
      vertex += FLOATS_PER_VERTEX
    ) {
      // world coordinates normalized to [0, 32] plus texture (10 bits)
      const lx = (4 * (geometry[vertex + 0] + x)) & 511;
      const ly = (4 * (geometry[vertex + 1] + y)) & 511;
      const lz = (4 * (geometry[vertex + 2] + z)) & 511;

      const u8 = Math.min(
        255,
        Math.max(0, Math.round(geometry[vertex + 3] * 255)),
      );
      const v8 = Math.min(
        255,
        Math.max(0, Math.round(geometry[vertex + 4] * 255)),
      );

      // [5 bits x, 5 bits y, 5 bits, z, 10 bits texture, ...]
      buf[offset++] = (lx << 18) | (ly << 9) | (lz << 0);
      buf[offset++] = ((texture & 65535) << 16) | (v8 << 8) | (u8 << 0);
    }

    return offset - start;
  }

  public getFullMesh(
    x: number,
    y: number,
    z: number,
    normals: boolean,
    uv: boolean,
    block: Block,
    orientation: number,
  ): Float32Array {
    const buf: number[] = [];
    if (orientation == undefined) orientation = 0;

    let offset = 0;
    for (let face = 0; face < 6; face += 1) {
      const geometry = this.bakedFaces[orientation][face];
      const realface = ORIENTATION_FACE_MAP[orientation][face];
      const n = FACE_NORMALS[realface];
      const localface = ORIENTATION_FACE_MAP[orientation][face];
      const texture = block.textures[localface % block.textures.length].ID; // Wrap with modulo in case of one single texture

      for (let v = 0; v < geometry.length; v += FLOATS_PER_VERTEX) {
        buf[offset++] = geometry[v + 0] + x;
        buf[offset++] = geometry[v + 1] + y;
        buf[offset++] = geometry[v + 2] + z;
        if (normals) {
          buf[offset++] = n[0];
          buf[offset++] = n[1];
          buf[offset++] = n[2];
        }
        if (uv) {
          buf[offset++] = geometry[v + 3];
          buf[offset++] = geometry[v + 4];
        }
        buf[offset++] = texture ?? 0;
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
      p = vec3.set(src[i + 0] - c, src[i + 1] - c, src[i + 2] - c);
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

  public getOutlineEdges(
    block: Vec3,
    orientation: number,
    cameraPos: Vec3,
  ): Float32Array {
    const edges = this.edgeConnectivity[orientation];
    const quads: number[] = [];

    const viewDir = vec3.create(
      block[0] + 0.5 - cameraPos[0],
      block[1] + 0.5 - cameraPos[1],
      block[2] + 0.5 - cameraPos[2],
    );

    const faceVisible = new Array(6);
    for (let i = 0; i < 6; i++) {
      faceVisible[i] = vec3.dot(FACE_NORMALS[i], viewDir) < 0;
    }

    const corners = [0, -1, 1, -1, 0, 1, 1, 1]; // Define the 4 corners of the quad (u, v)
    const indices = [0, 1, 2, 1, 3, 2]; // Two triangles (ABC and BDC) to form the quad

    for (let e = 0; e < edges.length; e++) {
      const edge = edges[e];
      const diffX = edge.p1[0] !== edge.p2[0] ? 1 : 0;
      const diffY = edge.p1[1] !== edge.p2[1] ? 1 : 0;
      const diffZ = edge.p1[2] !== edge.p2[2] ? 1 : 0;

      if (diffX + diffY + diffZ !== 1) continue; // An axis-aligned edge only has ONE dimension that changes.

      const p1 = vec3.add(edge.p1, block);
      const p2 = vec3.add(edge.p2, block);

      for (const index of indices) {
        const c1 = corners[2 * index + 0]; // Progress along line
        const c2 = corners[2 * index + 1]; // Offset across line
        quads.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], c1, c2);
      }
    }

    return new Float32Array(quads);
  }
}

// PX = 0, NX = 1, PY = 2, NY = 3, PZ = 4, NZ = 5
const CUBE_MESH: Mesh = new Mesh(0b111111, [
  new Float32Array([
    //x  y  z  u  v  t
    1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1,
    1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0,
  ]),
  new Float32Array([
    0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0,
    1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0,
  ]),
  new Float32Array([
    0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1,
    1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0,
  ]),
  new Float32Array([
    0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1,
    0, 0, 1, 0, 0, 1, 0, 1, 1, 1, 0,
  ]),
  new Float32Array([
    0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1,
    1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0,
  ]),
  new Float32Array([
    1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0,
    1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0,
  ]),
]);

const FENCE_MESH = new Mesh(0b000000, [
  new Float32Array([
    //  x  y  z  n  n  n  u  v  t
    0.625, 0, 0.375, 0.25, 1.0, 0, 0.625, 1, 0.375, 0.25, 0.0, 0, 0.625, 1,
    0.625, 0.0, 0.0, 0, 0.625, 0, 0.375, 0.25, 1.0, 0, 0.625, 1, 0.625, 0.0,
    0.0, 0, 0.625, 0, 0.625, 0.0, 1.0, 0,
  ]),
  new Float32Array([
    0.375, 0, 0.625, 0.25, 1.0, 0, 0.375, 1, 0.625, 0.25, 0.0, 0, 0.375, 1,
    0.375, 0.0, 0.0, 0, 0.375, 0, 0.625, 0.25, 1.0, 0, 0.375, 1, 0.375, 0.0,
    0.0, 0, 0.375, 0, 0.375, 0.0, 1.0, 0,
  ]),
  new Float32Array([
    0.375, 1, 0.375, 0.0, 0.25, 0, 0.375, 1, 0.625, 0.0, 0.0, 0, 0.625, 1,
    0.625, 0.25, 0.0, 0, 0.375, 1, 0.375, 0.0, 0.25, 0, 0.625, 1, 0.625, 0.25,
    0.0, 0, 0.625, 1, 0.375, 0.25, 0.25, 0,
  ]),
  new Float32Array([
    0.375, 0, 0.625, 0.0, 0.25, 0, 0.375, 0, 0.375, 0.0, 0.0, 0, 0.625, 0,
    0.375, 0.25, 0.0, 0, 0.375, 0, 0.625, 0.0, 0.25, 0, 0.625, 0, 0.375, 0.25,
    0.0, 0, 0.625, 0, 0.625, 0.25, 0.25, 0,
  ]),
  new Float32Array([
    0.375, 0, 0.625, 0.0, 1.0, 0, 0.625, 0, 0.625, 0.25, 1.0, 0, 0.625, 1,
    0.625, 0.25, 0.0, 0, 0.375, 0, 0.625, 0.0, 1.0, 0, 0.625, 1, 0.625, 0.25,
    0.0, 0, 0.375, 1, 0.625, 0.0, 0.0, 0,
  ]),
  new Float32Array([
    0.625, 0, 0.375, 0.0, 1.0, 0, 0.375, 0, 0.375, 0.25, 1.0, 0, 0.375, 1,
    0.375, 0.25, 0.0, 0, 0.625, 0, 0.375, 0.0, 1.0, 0, 0.375, 1, 0.375, 0.25,
    0.0, 0, 0.625, 1, 0.375, 0.0, 0.0, 0,
  ]),
]);

const SLAB_MESH: Mesh = new Mesh(
  0b001000, // only occludes bottom
  [
    new Float32Array([
      //x    y    z  u  v    t
      1.0, 0.0, 0, 1, 0.5, 0, 1.0, 0.5, 0, 1, 0.0, 0, 1.0, 0.5, 1, 0, 0.0, 0,
      1.0, 0.0, 0, 1, 0.5, 0, 1.0, 0.5, 1, 0, 0.0, 0, 1.0, 0.0, 1, 0, 0.5, 0,
    ]),
    new Float32Array([
      0.0, 0.0, 1, 1, 0.5, 0, 0.0, 0.5, 1, 1, 0.0, 0, 0.0, 0.5, 0, 0, 0.0, 0,
      0.0, 0.0, 1, 1, 0.5, 0, 0.0, 0.5, 0, 0, 0.0, 0, 0.0, 0.0, 0, 0, 0.5, 0,
    ]),
    new Float32Array([
      0, 0.5, 0, 0, 1, 0, 0, 0.5, 1, 0, 0, 0, 1, 0.5, 1, 1, 0, 0, 0, 0.5, 0, 0,
      1, 0, 1, 0.5, 1, 1, 0, 0, 1, 0.5, 0, 1, 1, 0,
    ]),
    new Float32Array([
      0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1,
      0, 0, 1, 0, 0, 1, 0, 1, 1, 1, 0,
    ]),
    new Float32Array([
      0.0, 0.0, 1, 0, 0.5, 0, 1.0, 0.0, 1, 1, 0.5, 0, 1.0, 0.5, 1, 1, 0.0, 0,
      0.0, 0.0, 1, 0, 0.5, 0, 1.0, 0.5, 1, 1, 0.0, 0, 0.0, 0.5, 1, 0, 0.0, 0,
    ]),
    new Float32Array([
      1.0, 0.0, 0, 0, 0.5, 0, 0.0, 0.0, 0, 1, 0.5, 0, 0.0, 0.5, 0, 1, 0.0, 0,
      1.0, 0.0, 0, 0, 0.5, 0, 0.0, 0.5, 0, 1, 0.0, 0, 1.0, 0.5, 0, 0, 0.0, 0,
    ]),
  ],
);

const TRANSPARENT_CUBE_MESH: Mesh = new Mesh(0b000000, [
  new Float32Array([
    //x  y  z  u  v  t
    1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1,
    1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0,
  ]),
  new Float32Array([
    0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0,
    1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0,
  ]),
  new Float32Array([
    0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1,
    1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0,
  ]),
  new Float32Array([
    0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1,
    0, 0, 1, 0, 0, 1, 0, 1, 1, 1, 0,
  ]),
  new Float32Array([
    0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1,
    1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0,
  ]),
  new Float32Array([
    1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0,
    1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0,
  ]),
]);
// PX = 0, NX = 1, PY = 2, NY = 3, PZ = 4, NZ = 5
const STAIRS_MESH: Mesh = new Mesh(0b101000, [
  new Float32Array([
    1.0, 0.0, 0.0, 1.0, 0.0, 0,
    //
    1.0, 0.5, 1.0, 0.0, 0.5, 0,
    //
    1.0, 0.0, 1.0, 0.0, 0.0, 0,
    //
    1.0, 0.0, 0.0, 1.0, 0.0, 0,
    //
    1.0, 0.5, 0.0, 1.0, 0.5, 0,
    //
    1.0, 0.5, 1.0, 0.0, 0.5, 0,

    //
    1.0, 1.0, 0.0, 1.0, 1.0, 0,
    //
    1.0, 1.0, 0.5, 0.5, 1.0, 0,
    //
    1.0, 0.5, 0.5, 0.5, 0.5, 0,
    //
    1.0, 1.0, 0.0, 1.0, 1.0, 0,
    //
    1.0, 0.5, 0.5, 0.5, 0.5, 0,
    //
    1.0, 0.5, 0.0, 1.0, 0.5, 0,
  ]),
  new Float32Array([
    0.0, 0.0, 0.0, 0.0, 0.0, 0,
    //
    0.0, 0.0, 1.0, 1.0, 0.0, 0,
    //
    0.0, 0.5, 1.0, 1.0, 0.5, 0,
    //
    0.0, 0.0, 0.0, 0.0, 0.0, 0,
    //
    0.0, 0.5, 1.0, 1.0, 0.5, 0,
    //
    0.0, 0.5, 0.0, 0.0, 0.5, 0,
    //

    0.0, 0.5, 0.0, 0.0, 0.5, 0,
    //
    0.0, 0.5, 0.5, 0.5, 0.5, 0,
    //
    0.0, 1.0, 0.5, 0.5, 1.0, 0,
    //
    0.0, 0.5, 0.0, 0.0, 0.5, 0,
    //
    0.0, 1.0, 0.5, 0.5, 1.0, 0,
    //
    0.0, 1.0, 0.0, 0.0, 1.0, 0,
  ]),
  new Float32Array([
    0.0, 1.0, 0.0, 0.0, 1.0, 0,
    //
    0.0, 1.0, 0.5, 0.0, 0.5, 0,
    //
    1.0, 1.0, 0.0, 1.0, 1.0, 0,
    //
    0.0, 1.0, 0.5, 0.0, 0.5, 0,
    //
    1.0, 1.0, 0.5, 1.0, 0.5, 0,
    //
    1.0, 1.0, 0.0, 1.0, 1.0, 0,
    //

    0.0, 0.5, 0.5, 0.0, 0.5, 0,
    //
    0.0, 0.5, 1.0, 0.0, 0.0, 0,
    //
    1.0, 0.5, 0.5, 1.0, 0.5, 0,
    //
    0.0, 0.5, 1.0, 0.0, 0.0, 0,
    //
    1.0, 0.5, 1.0, 1.0, 0.0, 0,
    //
    1.0, 0.5, 0.5, 1.0, 0.5, 0,
  ]),
  new Float32Array([
    1.0, 0.0, 0.0, 1.0, 1.0, 0,
    //
    0.0, 0.0, 1.0, 0.0, 0.0, 0,
    //
    0.0, 0.0, 0.0, 0.0, 1.0, 0,
    //

    1.0, 0.0, 0.0, 1.0, 1.0, 0,
    //
    1.0, 0.0, 1.0, 1.0, 0.0, 0,
    //
    0.0, 0.0, 1.0, 0.0, 0.0, 0,
  ]),
  new Float32Array([
    1.0, 1.0, 0.5, 1.0, 1.0, 0,
    //
    0.0, 1.0, 0.5, 0.0, 1.0, 0,
    //
    0.0, 0.5, 0.5, 0.0, 0.5, 0,
    //
    1.0, 1.0, 0.5, 1.0, 1.0, 0,
    //
    0.0, 0.5, 0.5, 0.0, 0.5, 0,
    //
    1.0, 0.5, 0.5, 1.0, 0.5, 0,
    //

    1.0, 0.5, 1.0, 1.0, 0.5, 0,
    //
    0.0, 0.5, 1.0, 0.0, 0.5, 0,
    //
    0.0, 0.0, 1.0, 0.0, 0.0, 0,
    //
    1.0, 0.5, 1.0, 1.0, 0.5, 0,
    //
    0.0, 0.0, 1.0, 0.0, 0.0, 0,
    //
    1.0, 0.0, 1.0, 1.0, 0.0, 0,
  ]),
  new Float32Array([
    0.0, 0.0, 0.0, 1.0, 0.0, 0,
    //
    0.0, 1.0, 0.0, 1.0, 1.0, 0,
    //
    1.0, 0.0, 0.0, 0.0, 0.0, 0,
    //
    0.0, 1.0, 0.0, 1.0, 1.0, 0,
    //
    1.0, 1.0, 0.0, 0.0, 1.0, 0,
    //
    1.0, 0.0, 0.0, 0.0, 0.0, 0,
  ]),
]);

export type MeshID = number;
export const MESHES = [
  CUBE_MESH,
  FENCE_MESH,
  SLAB_MESH,
  TRANSPARENT_CUBE_MESH,
  STAIRS_MESH,
] as const;
export const MESH: Record<
  "CUBE" | "FENCE" | "SLAB" | "OPAQUE_CUBE" | "STAIRS",
  MeshID
> = {
  CUBE: 0,
  FENCE: 1,
  SLAB: 2,
  OPAQUE_CUBE: 3,
  STAIRS: 4,
};
export type MESH = (typeof MESH)[keyof typeof MESH];

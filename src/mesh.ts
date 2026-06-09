import { mat3, Mat3, vec2, Vec2, Vec3, vec3 } from "wgpu-matrix";
import { FLOATS_PER_VERTEX } from "./constants";
import { HitResult, Ray, Shape, Sixtuple } from "./types";
import { Block } from "./registries/block-registry";
import { BlockData } from "./block";

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
  private readonly hitboxes: Shape[][] = []; // Maps hitboxes[orientation] -> shapes of mesh

  constructor(
    cullingmask: number,
    hitbox: Shape[],
    base: Sixtuple<Float32Array>,
  ) {
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

      this.hitboxes[orientation] = hitbox.map((shape) =>
        this.rotateShape(shape, matrix),
      );

      this.edgeConnectivity[orientation] = this.precomputeEdges(orientation);
    }
  }

  // Helper method to rotate a shape using the orientation matrix
  private rotateShape(shape: Shape, matrix: Mat3): Shape {
    if (shape.type === "box") {
      const [px, py, pz] = [shape.pos[0], shape.pos[1], shape.pos[2]];
      const [sx, sy, sz] = [shape.size[0], shape.size[1], shape.size[2]];

      // 1. Generate all 8 corners and shift them to center-relative space (-0.5 to 0.5)
      const corners = [
        [px, py, pz],
        [px + sx, py, pz],
        [px, py + sy, pz],
        [px + sx, py + sy, pz],
        [px, py, pz + sz],
        [px + sx, py, pz + sz],
        [px, py + sy, pz + sz],
        [px + sx, py + sy, pz + sz],
      ].map(([cx, cy, cz]) =>
        vec3.transformMat3(vec3.create(cx - 0.5, cy - 0.5, cz - 0.5), matrix),
      );

      // 2. Find min/max across ALL 8 corners
      const minX = Math.min(...corners.map((c) => c[0]));
      const minY = Math.min(...corners.map((c) => c[1]));
      const minZ = Math.min(...corners.map((c) => c[2]));

      const maxX = Math.max(...corners.map((c) => c[0]));
      const maxY = Math.max(...corners.map((c) => c[1]));
      const maxZ = Math.max(...corners.map((c) => c[2]));

      // 3. Add 0.5 back to restore local block space coordinates (0 to 1)
      const newMin = vec3.create(minX + 0.5, minY + 0.5, minZ + 0.5);
      const newMax = vec3.create(maxX + 0.5, maxY + 0.5, maxZ + 0.5);

      return {
        type: "box",
        pos: newMin,
        size: vec3.subtract(newMax, newMin),
      };
    } else {
      // Sphere: Shift to center, rotate, shift back
      const localCenter = vec3.subtract(shape.pos, vec3.create(0.5, 0.5, 0.5));
      const rotatedCenter = vec3.transformMat3(localCenter, matrix);
      return {
        type: "sphere",
        pos: vec3.add(rotatedCenter, vec3.create(0.5, 0.5, 0.5)),
        radius: shape.radius,
      };
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
      const lx = (16 * (geometry[vertex + 0] + x)) & 1023;
      const ly = (16 * (geometry[vertex + 1] + y)) & 1023;
      const lz = (16 * (geometry[vertex + 2] + z)) & 1023;

      const u8 = Math.min(
        255,
        Math.max(0, Math.round(geometry[vertex + 3] * 255)),
      );
      const v8 = Math.min(
        255,
        Math.max(0, Math.round(geometry[vertex + 4] * 255)),
      );

      // [5 bits x, 5 bits y, 5 bits, z, 10 bits texture, ...]
      buf[offset++] = (lx << 20) | (ly << 10) | (lz << 0);
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
    block: BlockData,
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

  // Intersect ray (in world space) against this mesh at blockPos with given orientation.
  // Returns the hit distance squared (or distance) if hit, otherwise Infinity.
  // Main intersection test against this mesh placed at blockPos with given orientation
  public intersectRay(
    ray: Ray,
    blockPos: Vec3,
    orientation: number,
  ): HitResult | null {
    const shapes = this.hitboxes[orientation];
    let bestHit: HitResult | null = null;
    let bestDist = Infinity;

    for (const shape of shapes) {
      // Transform ray from world space to block‑local space (subtract block origin)
      const localOrigin = vec3.subtract(ray.origin, blockPos);
      let hitDist: number;
      let hitPointLocal: Vec3;
      let normalLocal: Vec3;

      if (shape.type === "box") {
        const result = this.rayAABBIntersection(
          localOrigin,
          ray.direction,
          shape.pos,
          shape.size,
        );
        if (!result) continue;
        hitDist = result.distance;
        hitPointLocal = result.point;
        normalLocal = result.normal;
      } else {
        // sphere
        const result = this.raySphereIntersection(
          localOrigin,
          ray.direction,
          shape.pos,
          shape.radius,
        );
        if (!result) continue;
        hitDist = result.distance;
        hitPointLocal = result.point;
        normalLocal = result.normal;
      }

      if (hitDist < bestDist && hitDist > 0) {
        bestDist = hitDist;
        const hitPointWorld = vec3.add(hitPointLocal, blockPos);
        // Compute UV: project hit point onto the plane defined by normal.
        // For boxes, this gives a (u,v) in [0,1] using the two axes perpendicular to normal.
        // For spheres, we map using spherical coordinates (not perfect, but usable).
        let uv: Vec2;
        if (shape.type === "box") {
          uv = this.computeUVForBox(
            hitPointLocal,
            normalLocal,
            shape.pos,
            shape.size,
          );
        } else {
          uv = this.computeUVForSphere(
            hitPointLocal,
            normalLocal,
            shape.radius,
          );
        }
        bestHit = {
          distance: hitDist,
          point: hitPointWorld,
          normal: normalLocal,
          uv,
        };
      }
    }
    return bestHit;
  }

  // Ray vs AABB – returns distance, hit point, and normal
  private rayAABBIntersection(
    origin: Vec3,
    dir: Vec3,
    min: Vec3,
    size: Vec3,
  ): { distance: number; point: Vec3; normal: Vec3 } | null {
    const max = vec3.add(min, size);
    let tmin = -Infinity,
      tmax = Infinity;
    let normal = vec3.create();

    for (let i = 0; i < 3; i++) {
      if (Math.abs(dir[i]) < 1e-8) {
        // Ray parallel to slab – no hit if origin outside
        if (origin[i] < min[i] || origin[i] > max[i]) return null;
      } else {
        const invDir = 1 / dir[i];
        let t1 = (min[i] - origin[i]) * invDir;
        let t2 = (max[i] - origin[i]) * invDir;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        if (t1 > tmin) {
          tmin = t1;
          normal = vec3.create();
          normal[i] = -Math.sign(dir[i]);
        }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return null;
      }
    }
    if (tmax < 0) return null;
    const distance = tmin > 0 ? tmin : tmax;
    const point = vec3.create(
      origin[0] + dir[0] * distance,
      origin[1] + dir[1] * distance,
      origin[2] + dir[2] * distance,
    );
    return { distance, point, normal: vec3.negate(normal) };
  }

  // Ray vs sphere – returns distance, hit point, and normal
  private raySphereIntersection(
    origin: Vec3,
    dir: Vec3,
    center: Vec3,
    radius: number,
  ): { distance: number; point: Vec3; normal: Vec3 } | null {
    const oc = vec3.subtract(origin, center);
    const b = 2 * vec3.dot(oc, dir);
    const c = vec3.dot(oc, oc) - radius * radius;
    const disc = b * b - 4 * c;
    if (disc < 0) return null;
    const sqrtDisc = Math.sqrt(disc);
    const t1 = (-b - sqrtDisc) * 0.5;
    const t2 = (-b + sqrtDisc) * 0.5;
    let t = t1 > 0 ? t1 : t2;
    if (t <= 0) return null;
    const point = vec3.create(
      origin[0] + dir[0] * t,
      origin[1] + dir[1] * t,
      origin[2] + dir[2] * t,
    );
    const normal = vec3.normalize(vec3.subtract(point, center));
    return { distance: t, point, normal };
  }

  // Compute UV for box hit: project point onto the face defined by normal.
  private computeUVForBox(
    pointLocal: Vec3,
    normal: Vec3,
    min: Vec3,
    size: Vec3,
  ): Vec2 {
    const uAxis = Math.abs(normal[0]) > 0.5 ? 1 : 0; // if normal along X, use YZ plane
    const vAxis =
      Math.abs(normal[1]) > 0.5 ? 2 : Math.abs(normal[0]) > 0.5 ? 2 : 1;
    // Map point from [min, max] to [0,1] on the two axes
    let u = (pointLocal[uAxis] - min[uAxis]) / size[uAxis];
    let v = (pointLocal[vAxis] - min[vAxis]) / size[vAxis];
    // Clamp and flip if needed (normals point outward)
    u = Math.min(1, Math.max(0, u));
    v = Math.min(1, Math.max(0, v));
    return vec2.create(u, v);
  }

  // For spheres: simple equirectangular mapping using normal direction.
  private computeUVForSphere(
    pointLocal: Vec3,
    normal: Vec3,
    radius: number,
  ): Vec2 {
    // Normal is already the direction from center to point
    const theta = Math.atan2(normal[2], normal[0]); // -pi..pi
    const phi = Math.asin(normal[1]); // -pi/2..pi/2
    const u = (theta + Math.PI) / (2 * Math.PI);
    const v = (phi + Math.PI / 2) / Math.PI;
    return vec2.create(u, v);
  }
}

// PX = 0, NX = 1, PY = 2, NY = 3, PZ = 4, NZ = 5
const CUBE_MESH: Mesh = new Mesh(
  0b111111,
  [{ type: "box", pos: vec3.create(0, 0, 0), size: vec3.create(1, 1, 1) }],
  [
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
  ],
);

const FENCE_MESH = new Mesh(
  0b000000,
  [
    {
      type: "box",
      pos: vec3.create(0.375, 0, 0.375),
      size: vec3.create(0.25, 1, 0.25),
    },
  ],
  [
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
  ],
);

const SLAB_MESH: Mesh = new Mesh(
  0b001000, // only occludes bottom
  [{ type: "box", pos: vec3.create(0, 0, 0), size: vec3.create(1, 0.5, 1) }],
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

const TRANSPARENT_CUBE_MESH: Mesh = new Mesh(
  0b000000,
  [{ type: "box", pos: vec3.create(0, 0, 0), size: vec3.create(1, 1, 1) }],
  [
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
  ],
);
// PX = 0, NX = 1, PY = 2, NY = 3, PZ = 4, NZ = 5
const STAIRS_MESH: Mesh = new Mesh(
  0b101000,
  [
    {
      type: "box",
      pos: vec3.create(0.0, 0.0, 0.0),
      size: vec3.create(1.0, 0.5, 1.0),
    },
    {
      type: "box",
      pos: vec3.create(0.5, 0.5, 0.0),
      size: vec3.create(0.5, 0.5, 1.0),
    },
  ],
  [
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
  ],
);

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

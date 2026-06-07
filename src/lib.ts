import { CHUNK_SIZE } from "./constants";
import { CAMERA_HEIGHT, PLAYER_HEIGHT, PLAYER_WIDTH } from "./constants";
import { World } from "./world";
import { vec2, Vec2, vec3, Vec3, vec4, Vec4 } from "wgpu-matrix";
import { DynamicBuffer } from "./classes/dynamic-buffer";
import { InventoryRow, ItemNames } from "./types";
import { Rand } from "./classes/random";
import { ROTATION } from "./mesh";
import { Registry, RegistryData } from "./registry";
import { BlockStateData } from "./blockstate";

export function clamp(min: number, value: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// TODO more general method
export function collides(
  pos: Vec3,
  world: World,
  reg: RegistryData<BlockStateData>,
): Vec3 | null {
  const hitbox = {
    min: vec3.floor(
      vec3.create(
        pos[0] - PLAYER_WIDTH / 2,
        pos[1] - CAMERA_HEIGHT,
        pos[2] - PLAYER_WIDTH / 2,
      ),
    ),
    max: vec3.floor(
      vec3.create(
        pos[0] + PLAYER_WIDTH / 2,
        pos[1] + PLAYER_HEIGHT - CAMERA_HEIGHT,
        pos[2] + PLAYER_WIDTH / 2,
      ),
    ),
  };

  for (let x = hitbox.min[0]; x <= hitbox.max[0]; x++) {
    for (let y = hitbox.min[1]; y <= hitbox.max[1]; y++) {
      for (let z = hitbox.min[2]; z <= hitbox.max[2]; z++) {
        // Check whether any position is inside a block of a chunk
        const local = vec3ToLocalChunk(vec3.create(x, y, z)); // local position in chunk
        const offset = vec3.floor(
          vec3.divScalar(vec3.create(x, y, z), CHUNK_SIZE),
        );
        const chunk = world.getChunk(offset);

        if (!chunk) continue;

        const state = chunk.get(local[0], local[1], local[2]);
        const ID = Registry.get(reg, "hash", state).block.ID;

        if (ID == 0) continue;

        return vec3.create(x, y, z);
      }
    }
  }

  return null;
}

const KB = 1024;
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;
type Size = `${number}${"KB" | "MB" | "GB"}`;

export function ReadOnlyStorage(device: GPUDevice, size?: Size): DynamicBuffer {
  let bytes: undefined | number = undefined;
  const match = size?.match(/(\d+)(.+)/);

  if (match) {
    const num = Number(match[1]);
    const type = match[2];
    const mult = type == "KB" ? KB : type == "MB" ? MB : GB;
    bytes = num * mult;
  }

  return new DynamicBuffer(
    device,
    GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    bytes,
  );
}

export function Uniform(
  device: GPUDevice,
  data: ArrayBufferView,
): DynamicBuffer {
  return new DynamicBuffer(
    device,
    GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    data,
  );
}

export function u32(...values: number[]) {
  return new Uint32Array([...values]);
}

export function i32(...values: number[]) {
  return new Int32Array([...values]);
}

export function f32(...values: number[]) {
  return new Float32Array([...values]);
}

export function vec3ToLocalChunk(v: Vec3): Vec3 {
  return vec3.create(
    ((v[0] % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    ((v[1] % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    ((v[2] % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
  );
}

export function dda(
  start: Vec3,
  dir: Vec3,
  maxDist: number,
): { pos: Vec3; face: Vec3; uv: Vec2 }[] {
  const hits: { pos: Vec3; face: Vec3; uv: Vec2 }[] = [];

  let x = Math.floor(start[0]);
  let y = Math.floor(start[1]);
  let z = Math.floor(start[2]);

  const sx = Math.sign(dir[0]);
  const sy = Math.sign(dir[1]);
  const sz = Math.sign(dir[2]);

  const dx = Math.abs(1 / dir[0]);
  const dy = Math.abs(1 / dir[1]);
  const dz = Math.abs(1 / dir[2]);

  let mx = (sx > 0 ? x + 1 - start[0] : start[0] - x) * dx;
  let my = (sy > 0 ? y + 1 - start[1] : start[1] - y) * dy;
  let mz = (sz > 0 ? z + 1 - start[2] : start[2] - z) * dz;

  let dist = 0;
  while (dist < maxDist) {
    // starting cell has no face because we didn't cross anything yet
    if (hits.length === 0) {
      hits.push({
        pos: vec3.create(x, y, z),
        face: vec3.create(0, 0, 0),
        uv: vec2.create(0.0, 0.0),
      });
    }

    if (mx < my) {
      if (mx < mz) {
        // crossed an X boundary
        dist = mx;
        mx += dx;
        x += sx;

        const t = dist;
        const hitPoint = vec3.create(
          start[0] + dir[0] * t,
          start[1] + dir[1] * t,
          start[2] + dir[2] * t,
        );

        // UV coordinates: Y and Z components (local to the face)
        const u = hitPoint[2] - Math.floor(hitPoint[2]);
        const v = hitPoint[1] - Math.floor(hitPoint[1]);

        hits.push({
          pos: vec3.create(x, y, z),
          face: vec3.create(sx, 0, 0),
          uv: vec2.create(u, v),
        });
      } else {
        // crossed a Z boundary
        dist = mz;
        mz += dz;
        z += sz;

        const t = dist;
        const hitPoint = vec3.create(
          start[0] + dir[0] * t,
          start[1] + dir[1] * t,
          start[2] + dir[2] * t,
        );

        // UV coordinates: X and Y components (local to the face)
        const u = hitPoint[0] - Math.floor(hitPoint[0]);
        const v = hitPoint[1] - Math.floor(hitPoint[1]);

        hits.push({
          pos: vec3.create(x, y, z),
          face: vec3.create(0, 0, sz),
          uv: vec2.create(u, v),
        });
      }
    } else {
      if (my < mz) {
        // crossed a Y boundary
        dist = my;
        my += dy;
        y += sy;

        const t = dist;
        const hitPoint = vec3.create(
          start[0] + dir[0] * t,
          start[1] + dir[1] * t,
          start[2] + dir[2] * t,
        );

        // UV coordinates: X and Z components (local to the face)
        const u = hitPoint[0] - Math.floor(hitPoint[0]);
        const v = hitPoint[2] - Math.floor(hitPoint[2]);

        hits.push({
          pos: vec3.create(x, y, z),
          face: vec3.create(0, sy, 0),
          uv: vec2.create(u, v),
        });
      } else {
        // crossed a Z boundary
        dist = mz;
        mz += dz;
        z += sz;

        const t = dist;
        const hitPoint = vec3.create(
          start[0] + dir[0] * t,
          start[1] + dir[1] * t,
          start[2] + dir[2] * t,
        );

        // UV coordinates: X and Y components (local to the face)
        const u = hitPoint[0] - Math.floor(hitPoint[0]);
        const v = hitPoint[1] - Math.floor(hitPoint[1]);

        hits.push({
          pos: vec3.create(x, y, z),
          face: vec3.create(0, 0, sz),
          uv: vec2.create(u, v),
        });
      }
    }
  }

  return hits;
}

export async function loadTexturesFromUrls(
  urls: string[],
): Promise<{ [key: string]: HTMLImageElement }> {
  const map: { [key: string]: HTMLImageElement } = {};

  await Promise.all(
    urls.map(
      (url) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.src = url;
          img.onload = () => resolve(img);
          img.onerror = () =>
            reject(new Error(`Failed to load image: ${img.src}`));

          map[url] = img;
        }),
    ),
  );

  return map; // this is now HTMLImageElement[]
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = url;
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Failed to load image from ${image.src}`));
  });
}

export async function getImageData(url: string): Promise<ImageData> {
  const bitmap = await fetch(url)
    .then((r) => r.blob())
    .then(createImageBitmap);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(bitmap, 0, 0);

  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

function packVertex(
  x: number,
  y: number,
  z: number,
  r: number,
  g: number,
  b: number,
  a: number,
): [number, number] {
  const pos = (x << 8) | (y << 4) | z;
  const color = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
  return [pos, color];
}

function pushQuad(
  vertices: number[],
  p0: Vec3,
  p1: Vec3,
  p2: Vec3,
  p3: Vec3,
  rgba: Vec4,
) {
  // Two triangles: p0 p1 p2, p0 p2 p3
  for (const p of [p0, p1, p2, p0, p2, p3]) {
    const [pos, color] = packVertex(
      p[0],
      p[1],
      p[2],
      rgba[0],
      rgba[1],
      rgba[2],
      rgba[3],
    );
    vertices.push(pos, color);
  }
}

export async function createItemMesh(url: string): Promise<Uint32Array> {
  const { data, width, height } = await getImageData(url);
  const vertices: number[] = [];

  const alpha = (px: number, py: number): number => {
    if (px < 0 || py < 0 || px >= width || py >= height) return 0;
    return data[4 * (py * width + px) + 3];
  };

  const DEPTH = 2; // thickness in "pixel units", so z goes 0..DEPTH
  const rgba = vec4.create();
  const first = vec3.create();
  const second = vec3.create();
  const third = vec3.create();
  const fourth = vec3.create();

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const i = 4 * (y * width + x);
      vec4.set(data[i + 0], data[i + 1], data[i + 2], data[i + 3], rgba);

      if (rgba[3] === 0) continue;

      // Front face (z = DEPTH)
      pushQuad(
        vertices,
        vec3.set(x, y, DEPTH, first),
        vec3.set(x + 1, y, DEPTH, second),
        vec3.set(x + 1, y + 1, DEPTH, third),
        vec3.set(x, y + 1, DEPTH, fourth),
        rgba,
      );

      // Back face (z = 0)
      pushQuad(
        vertices,
        vec3.set(x + 1, y, 0, first),
        vec3.set(x, y, 0, second),
        vec3.set(x, y + 1, 0, third),
        vec3.set(x + 1, y + 1, 0, fourth),
        rgba,
      );

      // Right face (+x neighbor transparent)
      if (alpha(x + 1, y) === 0) {
        pushQuad(
          vertices,
          vec3.set(x + 1, y, 0, first),
          vec3.set(x + 1, y + 1, 0, second),
          vec3.set(x + 1, y + 1, DEPTH, third),
          vec3.set(x + 1, y, DEPTH, fourth),
          rgba,
        );
      }

      // Left face (-x neighbor transparent)
      if (alpha(x - 1, y) === 0) {
        pushQuad(
          vertices,
          vec3.set(x, y, DEPTH, first),
          vec3.set(x, y + 1, DEPTH, second),
          vec3.set(x, y + 1, 0, third),
          vec3.set(x, y, 0, fourth),
          rgba,
        );
      }

      // Top face (-y neighbor transparent, y=0 is top)
      if (alpha(x, y - 1) === 0) {
        pushQuad(
          vertices,
          vec3.set(x, y, DEPTH, first),
          vec3.set(x, y, 0, second),
          vec3.set(x + 1, y, 0, third),
          vec3.set(x + 1, y, DEPTH, fourth),
          rgba,
        );
      }

      // Bottom face (+y neighbor transparent)
      if (alpha(x, y + 1) === 0) {
        pushQuad(
          vertices,
          vec3.set(x, y + 1, 0, first),
          vec3.set(x, y + 1, DEPTH, second),
          vec3.set(x + 1, y + 1, DEPTH, third),
          vec3.set(x + 1, y + 1, 0, fourth),
          rgba,
        );
      }
    }
  }

  return new Uint32Array(vertices);
}

export async function renderIsometricBlock(
  canvas: OffscreenCanvas,
  ctx: OffscreenCanvasRenderingContext2D,
  source: HTMLImageElement,
  size = 128,
): Promise<HTMLImageElement> {
  // 1. Reset and Prepare Canvas
  canvas.width = size;
  canvas.height = size;

  // Clear previous contents and reset any existing transforms
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;

  // 2. Constants for projection
  const cx = size / 2;
  const cy = size / 2;
  const S = size / 2;
  const f = S / source.width;

  // 4. Render Faces

  // --- TOP FACE ---
  ctx.setTransform(-f, f / 2, f, f / 2, cx, cy - S);
  ctx.drawImage(source, 0, 0);

  // --- LEFT FACE ---
  ctx.setTransform(f, f / 2, 0, f, cx - S, cy - S / 2);
  ctx.drawImage(source, 0, 0);
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(0, 0, source.width, source.height);

  // --- RIGHT FACE ---
  ctx.setTransform(f, -f / 2, 0, f, cx, cy);
  ctx.drawImage(source, 0, 0);
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.fillRect(0, 0, source.width, source.height);

  // Export Logic for OffscreenCanvas
  const blob = await canvas.convertToBlob({ type: "image/png" });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const result = new Image();
    result.onload = () => {
      // Clean up the object URL to prevent memory leaks
      URL.revokeObjectURL(url);
      resolve(result);
    };
    result.onerror = reject;
    result.src = url;
  });
}

export function generateInventoryRow(): InventoryRow {
  return Array.from({ length: 9 }).map(() =>
    Rand.choice([
      [0.2, null],
      [0.8, [Rand.range(1, 64), Rand.array(ItemNames)]],
    ]),
  ) as InventoryRow;
}

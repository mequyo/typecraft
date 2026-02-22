import { CHUNK_SIZE, IMAGE_SIZE } from "./constants";
import { CAMERA_HEIGHT, PLAYER_HEIGHT, PLAYER_WIDTH } from "./constants";
import { World } from "./world";
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { AIR } from "./registries/blocks";
import { vec3, Vec3 } from "wgpu-matrix";
import { Chunk } from "./chunk";
import { BlockRegistry } from "./registries/block-registry";
import { FACE, FACE_NORMALS, FACE_OPPOSITE_BIT, MESHES, ORIENTATION_FACE_MAP } from "./mesh";
import { createMeshes } from "./mesh-utils";
import { Sixtuple } from "./types";


export function collides(pos: Vec3, world: World): Vec3 | null {
  const hitbox = {
    min: vec3.floor(vec3.create(pos[0] - PLAYER_WIDTH / 2, pos[1] - CAMERA_HEIGHT, pos[2] - PLAYER_WIDTH / 2)),
    max: vec3.floor(vec3.create(pos[0] + PLAYER_WIDTH / 2, pos[1] + PLAYER_HEIGHT - CAMERA_HEIGHT, pos[2] + PLAYER_WIDTH / 2)),
  }

  for (let x = hitbox.min[0]; x <= hitbox.max[0]; x++) {
    for (let y = hitbox.min[1]; y <= hitbox.max[1]; y++) {
      for (let z = hitbox.min[2]; z <= hitbox.max[2]; z++) {
        // Check whether any position is inside a block of a chunk
        const local = vec3ToLocalChunk(vec3.create(x, y, z)); // local position in chunk
        const offset = vec3.floor(vec3.divScalar(vec3.create(x, y, z), CHUNK_SIZE));  // chunk offset
        const chunk = world.getChunk(offset);

        // TODO non-cube blocks

        if (chunk && BlockStateRegistry.decode(chunk.get(local[0], local[1], local[2])).block != AIR.ID) {
          return vec3.create(x, y, z);
        }
      }
    }
  }

  return null;
}

export function vec3ToLocalChunk(v: Vec3): Vec3 {
  return vec3.create(
    ((v[0] % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    ((v[1] % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    ((v[2] % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
  );
}


export function dda(start: Vec3, dir: Vec3, maxDist: number): { pos: Vec3, face: Vec3 }[] {
  const hits: { pos: Vec3, face: Vec3 }[] = [];

  let x = Math.floor(start[0]);
  let y = Math.floor(start[1]);
  let z = Math.floor(start[2]);

  const sx = Math.sign(dir[0]);
  const sy = Math.sign(dir[1]);
  const sz = Math.sign(dir[2]);

  const dx = Math.abs(1 / dir[0]);
  const dy = Math.abs(1 / dir[1]);
  const dz = Math.abs(1 / dir[2]);

  let mx = ((sx > 0 ? (x + 1) - start[0] : start[0] - x)) * dx;
  let my = ((sy > 0 ? (y + 1) - start[1] : start[1] - y)) * dy;
  let mz = ((sz > 0 ? (z + 1) - start[2] : start[2] - z)) * dz;

  let dist = 0;
  while (dist < maxDist) {
    // starting cell has no face because we didn't cross anything yet
    if (hits.length === 0) {
      hits.push({ pos: vec3.create(x, y, z), face: vec3.create(0, 0, 0) });
    }

    if (mx < my) {
      if (mx < mz) {
        // crossed an X boundary
        x += sx;
        hits.push({ pos: vec3.create(x, y, z), face: vec3.create(sx, 0, 0) });
        dist = mx;
        mx += dx;
      } else {
        // crossed a Z boundary
        z += sz;
        hits.push({ pos: vec3.create(x, y, z), face: vec3.create(0, 0, sz) });
        dist = mz;
        mz += dz;
      }
    } else {
      if (my < mz) {
        // crossed a Y boundary
        y += sy;
        hits.push({ pos: vec3.create(x, y, z), face: vec3.create(0, sy, 0) });
        dist = my;
        my += dy;
      } else {
        // crossed a Z boundary
        z += sz;
        hits.push({ pos: vec3.create(x, y, z), face: vec3.create(0, 0, sz) });
        dist = mz;
        mz += dz;
      }
    }
  }

  return hits;
}


export async function loadTexturesFromUrls(urls: string[]): Promise<{ [key: string]: HTMLImageElement }> {
  const map: { [key: string]: HTMLImageElement } = {};

  await Promise.all(
    urls.map(url =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${img.src}`));

        map[url] = img;
      })
    )
  );

  return map; // this is now HTMLImageElement[]
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = url;
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image from ${image.src}`));
  });
}

export async function bitmapFromBlockData(blocks: Uint16Array): Promise<ImageBitmap> {
  if (blocks.length != CHUNK_SIZE ** 3) throw new Error("Array should be CHUNK_SIZE^3 big");

  //const data = new Uint8ClampedArray(CHUNK_SIZE * CHUNK_SIZE * 4);
  const canvas = new OffscreenCanvas(CHUNK_SIZE * IMAGE_SIZE, CHUNK_SIZE * IMAGE_SIZE);
  const context = canvas.getContext("2d")!;

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {

        const index = Chunk.pack(x, y, z);

        const blockstate = blocks[index];
        const { block: ID, orientation } = BlockStateRegistry.decode(blockstate);

        const block = BlockRegistry.get(ID);
        const texture = block.textures[ORIENTATION_FACE_MAP[orientation][FACE.PY] % block.textures.length];

        //console.log(texture.bitmap)

        //context.drawImage(texture.bitmap!, x * IMAGE_SIZE, z * IMAGE_SIZE);

        //const color = colormap[ID];
        //const dataindex = 4 * (z * CHUNK_SIZE + x);

        //data[dataindex + 0] = color[0];
        //data[dataindex + 1] = color[1];
        //data[dataindex + 2] = color[2];
        //data[dataindex + 3] = color[3];
      }
    }
  }

  //const imagedata = new ImageData(data, CHUNK_SIZE, CHUNK_SIZE);
  return await createImageBitmap(canvas);
}

// `createMeshes` moved to `mesh-utils.ts` to keep this module free of canvas/bitmap imports
import type { Vec3 } from "wgpu-matrix"

export type WorkerMessageIn = { offset: Vec3, neighbors: Sixtuple<Uint16Array> }
export type WorkerMessageOut = {
  offset: ArrayBuffer,
  blocks: ArrayBuffer,
  heightmap: ArrayBuffer,
  bitmap: ImageBitmap,
  mesh: ArrayBuffer,
  amount: ArrayBuffer,
  meshes: [ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer, ArrayBuffer],
  lengths: Sixtuple<number>,
}


export type Sixtuple<T> = [T, T, T, T, T, T]
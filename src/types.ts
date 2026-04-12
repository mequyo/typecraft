import type { Vec3 } from "wgpu-matrix"

export type WorkerMessageIn = { offset: Vec3, neighbors: Sixtuple<Uint16Array | undefined> }
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

export type Devices = { canvas: HTMLCanvasElement, context: GPUCanvasContext, adapter: GPUAdapter, device: GPUDevice, audio: AudioContext };

export type Sixtuple<T> = [T, T, T, T, T, T];

export type ItemStack = [number, string]
export type InventoryRow = [ItemStack | null, ItemStack | null, ItemStack | null, ItemStack | null, ItemStack | null, ItemStack | null, ItemStack | null, ItemStack | null, ItemStack | null];
export type Inventory = [InventoryRow, InventoryRow, InventoryRow, InventoryRow];

export type Menu = "inventory" | "pause";
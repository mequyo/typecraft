import type { Vec3 } from "wgpu-matrix";
import { TextureName } from "./texture";
import { RegistryManagerData } from "./registry-manager";
import { MOUSE } from "./input-system";

export type ChunkMessage = {
  type: "chunk";
  offset: Vec3;
  neighbors: Sixtuple<Uint16Array | undefined>;
};
export type RegistryMessage = {
  type: "registries";
  manager: RegistryManagerData;
};
export type WorkerMessageIn = ChunkMessage | RegistryMessage;
export type WorkerMessageOut = {
  offset: ArrayBuffer;
  key: number;
  blocks: ArrayBuffer;
  heightmap: ArrayBuffer;
  bitmap: ImageBitmap;
  mesh: ArrayBuffer;
  amount: ArrayBuffer;
  meshes: [
    ArrayBuffer,
    ArrayBuffer,
    ArrayBuffer,
    ArrayBuffer,
    ArrayBuffer,
    ArrayBuffer,
  ];
  lengths: Sixtuple<number>;
};

export type UIClick = {
  button: MOUSE.LEFT | MOUSE.MIDDLE | MOUSE.RIGHT;
  menu: Menu;
  slot: [number, number];
};

export type Devices = {
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;
  adapter: GPUAdapter;
  device: GPUDevice;
  audio: AudioContext;
};

export type Sixtuple<T> = [T, T, T, T, T, T];

export const ItemNames = Object.keys(
  import.meta.glob("/public/items/*.png"),
).map((p) => p.split("/").at(-1)?.replace(".png", ""));

export type ItemName = (typeof ItemNames)[number];
export type ItemStack = [number, ItemName];
export type InventoryRow = [
  ItemStack | null,
  ItemStack | null,
  ItemStack | null,
  ItemStack | null,
  ItemStack | null,
  ItemStack | null,
  ItemStack | null,
  ItemStack | null,
  ItemStack | null,
];
export type Inventory = [
  InventoryRow,
  InventoryRow,
  InventoryRow,
  //InventoryRow,
];

export type Menu = "inventory" | "pause";

export type Stats = {
  time: number;
  cpu: { averageFPS: number; lows: number };
  gpu: { averageFPS: number; lows: number };
  player: {
    position: Vec3;
    direction: Vec3;
    lookat: Vec3 | null;
    speed: Vec3;
    biome: string;
  };
  chunks: {
    loaded: number;
    rendered: number;
    queued: number;
    memory: { usedBytes: number; totalBytes: number };
    avgGenTime: number;
  };
  vertices: number;
};

// Data for registries, testing for now

export type IteName = string & { _: "item name" };
export type ItemData = {
  name: IteName;
  display: string;
  textureID: TextureName;
};

export type RecipeData = {
  result: IteName;
  amount: number;
  input: IteName;
};

export type GameStore = {
  menu: Menu | null;
  inventory: Inventory | null;
  hotbar: InventoryRow | null;
  hotbarSelection: number;
  hand: ItemStack | null;
};

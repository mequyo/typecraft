import { ArenaBuffer } from "./classes/arena-buffer";
import { Minimap } from "./classes/minimap";
import { RenderPipeline } from "./render-pipeline";
import { Player } from "./player";
import { World } from "./world";
import { InputSystem } from "./input-system";
import { PhysicsSystem } from "./physics-system";
import { DynamicBuffer } from "./classes/dynamic-buffer";
import { UISystem } from "./ui-system.ts";
import { Profiler } from "./profiler.ts";
import { LVH } from "./classes/lvh.ts";
import { Vec3 } from "wgpu-matrix";
import { RegistryManagerData } from "./registry-manager.ts";

export type State = {
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;
  device: GPUDevice;
  adapter: GPUAdapter;
  audio: AudioContext;
  paused: boolean;

  depthTexture: GPUTexture;
  outlineTexture: GPUTexture;

  time_since_last_update: number;
  alpha: number;

  time: {
    last: number;
    dt: { cpu: number; gpu: number };
    seconds: number;
  };

  world: World;
  player: Player;
  render_distance: number;
  sphere_offsets: Vec3[];
  gpuIndrectionChunkMap: Uint32Array;
  gpuIndirectionBufferOrigin: Vec3;
  minimap: Minimap;

  chunkBuffer: ArenaBuffer;
  lvh: LVH;
  pipelines: RenderPipeline[];

  indirectBuffer: DynamicBuffer;

  registrymanager: RegistryManagerData;
  profiler: Profiler;
  input: InputSystem;
  physics: PhysicsSystem;
  ui: UISystem;
};

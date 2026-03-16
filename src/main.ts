import "./registries/textures"
import "./registries/blocks"

import "./augmentation/array";
import "./augmentation/math";
import "./augmentation/number";
import "./augmentation/image";
import "./augmentation/gpu-device";

import { CHUNK_SIZE, IMAGE_SIZE, MINIMAP_MAX_ZOOM, MINIMAP_MIN_ZOOM, } from "./constants";
import { Camera } from "./camera";
import { update } from "./update";
import { TerrainGenerator } from "./terrain-generator";
import { vec3 } from "wgpu-matrix";
import { State } from "./state";
import { World } from "./world";
import { Player } from "./player";
import { loadImage, vec3ToLocalChunk } from "./lib";
import { RingBuffer } from "./classes/ring-buffer";
import { Minimap } from "./classes/minimap";
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { AIR, OAK_SLAB } from "./registries/blocks";
import { ORIENTATION } from "./mesh";
import { TextureRegistry } from "./registries/texture-registry";
import { SoundRegistry } from "./registries/sound-registry";
import { ArenaBuffer } from "./classes/arena-buffer";
import { MAIN_PIPELINE } from "./pipeline-descriptors/main-pipeline";
import { SKY_PIPELINE } from "./pipeline-descriptors/sky-pipeline";
import { DESTROY_PIPELINE } from "./pipeline-descriptors/destroy-pipeline";
import { OUTLINE_PIPELINE } from "./pipeline-descriptors/outline-pipeline";
import { ChunkBlocksComputePipeline } from "./pipeline-descriptors/chunk-blocks-compute-pipeline";
import { Chunk } from "./chunk";
import "./test"
import { InputSystem } from "./input-system";

window.onload = main;



type Devices = { canvas: HTMLCanvasElement, context: GPUCanvasContext, adapter: GPUAdapter, device: GPUDevice, audio: AudioContext }
async function initDevices(): Promise<Devices> {




  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("WebGPU context of canvas could not be retreived.");

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("Could not request GPU adapter.");

  const device = await adapter.requestDevice({
    requiredLimits: { maxBufferSize: adapter.limits.maxBufferSize },
    // @ts-ignore
    requiredFeatures: ["chromium-experimental-multi-draw-indirect"],
  });
  if (!device) throw new Error("Could not request GPU device.");

  context.configure({
    device,
    format: navigator.gpu.getPreferredCanvasFormat(),
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
  });

  return { canvas, context, adapter, device, audio: new AudioContext() };
}


async function createTextureArray(device: GPUDevice, width: number, height: number, images: ImageBitmap[]): Promise<GPUTexture> {
  const texture = device.createTexture({
    size: {
      width: width,
      height: height,
      depthOrArrayLayers: images.length,
    },
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  images.forEach((source, z) => {
    device.queue.copyExternalImageToTexture(
      { source },
      { texture, origin: { x: 0, y: 0, z } },
      { width, height },
    );
  });

  return texture;
}


async function main() {
  const { canvas, context, adapter, device, audio } = await initDevices();

  await TextureRegistry.awaitImages();
  await SoundRegistry.awaitSounds(audio);

  const textures = TextureRegistry.getAll().map<ImageBitmap>(texture => texture.bitmap!);
  const texturearray = await createTextureArray(device, IMAGE_SIZE, IMAGE_SIZE, textures);
  const textureview = texturearray.createView();


  const destroytextures = TextureRegistry.getAll().map<ImageBitmap>(texture => texture.bitmap!);
  const destroytexturearray = await createTextureArray(device, IMAGE_SIZE, IMAGE_SIZE, destroytextures);
  const destroytextureview = destroytexturearray.createView();



  // Create depth texture once
  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth24plus", // or "depth32float" if you need high precision
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });


  const minimap_arrow = await createImageBitmap(await loadImage("/ui/minimap-arrow.png"));



  // CREATE STATE
  const state: State = {
    canvas, context, adapter, device, depthTexture, audio,

    time: {
      last: 0,
      dt: { cpu: 0.01, gpu: 0.01 },
      seconds: 0,
    },
    world: new World(new TerrainGenerator()),
    player: new Player({
      creative: true,
      camera: new Camera({ canvas, active: true, position: vec3.create(-0.5, 78.5, 8) }),
    }),

    minimap: new Minimap(minimap_arrow),

    performance: {
      chunk_generation: new RingBuffer(200),
      chunk_meshing: new RingBuffer(100),
      cpu: new RingBuffer(100),
      gpu: new RingBuffer(100),
    },
    chunkBuffer: new ArenaBuffer(device, 2000 * 1024 * 1024, GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX, [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6], 64),

    pipelines: [
      SKY_PIPELINE(device),
      MAIN_PIPELINE(device, textureview),
      OUTLINE_PIPELINE(device),
      DESTROY_PIPELINE(device, destroytextureview),
    ],

    compute: new ChunkBlocksComputePipeline(device),

    input: new InputSystem(canvas),
  }

  Chunk.chunkBuffer = state.chunkBuffer;

  // LISTENERS
  window.onresize = () => {
    // Update canvas(es)
    canvas.width = Math.floor(window.devicePixelRatio * window.innerWidth);
    canvas.height = Math.floor(window.devicePixelRatio * window.innerHeight);
    // TODO update minimap as well

    // Update context
    context.configure({
      device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: "opaque",

      //size: [canvas.width, canvas.height],
    });

    // Update camera's aspect ratio
    state.player.aspectratio = canvas.width / canvas.height;

    // Update depth texture
    state.depthTexture.destroy();

    const depthTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    state.depthTexture = depthTexture;
  }


  requestAnimationFrame(timestamp => update(timestamp, state));
}
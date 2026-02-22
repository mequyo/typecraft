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
    keys: {},
    mouse: { left: false, right: false, middle: false },
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
  }

  Chunk.chunkBuffer = state.chunkBuffer;

  // LISTENERS
  // TODO even when deleting blocks in creative, sounds should play
  window.addEventListener("keydown", e => state.keys[e.key.toLowerCase()] = true);
  window.addEventListener("keyup", e => state.keys[e.key.toLowerCase()] = false);
  window.addEventListener("contextmenu", e => e.preventDefault());
  window.addEventListener("blur", _ => Object.keys(state.keys).forEach(k => state.keys[k] = false));
  window.addEventListener("wheel", e => {
    state.player.fov = Math.clamp(Math.PI / 180, state.player.fov + e.deltaY / 100 / 180 * Math.PI, 2 * Math.PI); // Clamp between 1° and 360°
  });
  window.addEventListener("keydown", e => {
    e.preventDefault();

    const key = e.key.toLowerCase();

    if (key == "c") state.player.creative = !state.player.creative;

    if (key == "+" && state.minimap.zoom < MINIMAP_MAX_ZOOM) {
      state.minimap.zoom *= 2;
    }

    if (key == "-" && state.minimap.zoom > MINIMAP_MIN_ZOOM) {
      state.minimap.zoom /= 2;
    }
  });
  window.addEventListener("click", e => {
    state.canvas.requestPointerLock();

    // 0 LEFT, 1 MIDDLE, 2 RIGHT

    if (e.button == 0 && state.player.lookat) {
      // Looking at a block
      const chunk = state.world.getChunk(vec3.floor(vec3.divScalar(state.player.lookat, CHUNK_SIZE)));

      if (chunk) {
        const local = vec3ToLocalChunk(state.player.lookat);
        //chunk.set(local[0], local[1], local[2], BlockStateRegistry.encode(AIR.ID, ORIENTATION.NX_0));
      }
    }

    if (e.button == 2 && state.player.lookat) {
      const position = vec3.sub(state.player.lookat, state.player.placeoffset);
      state.world.addBlock(position, BlockStateRegistry.encode(OAK_SLAB.ID, Math.floor(Math.random() * 24))); // TODO actually set orientation based on viewing direction
    }
  });
  window.addEventListener("mousedown", e => {
    switch (e.button) {
      case 0: return state.mouse.left = true;
      case 1: return state.mouse.middle = true;
      case 2: return state.mouse.right = true;
    }
  });
  window.addEventListener("mouseup", e => {
    switch (e.button) {
      case 0: return state.mouse.left = false;
      case 1: return state.mouse.middle = false;
      case 2: return state.mouse.right = false;
    }
  });
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

  update(state);
}
import "./augmentation/array.ts";
import "./augmentation/math.ts";
import "./augmentation/number.ts";

import { ChunkBlocksComputePipeline } from "./pipeline-descriptors/chunk-blocks-compute-pipeline.ts";
import { DESTROY_PIPELINE } from "./pipeline-descriptors/destroy-pipeline.ts";
import { OUTLINE_PIPELINE } from "./pipeline-descriptors/outline-pipeline.ts";
import { MAIN_PIPELINE } from "./pipeline-descriptors/main-pipeline.ts";
import { SKY_PIPELINE } from "./pipeline-descriptors/sky-pipeline.ts";
import { TextureRegistry } from "./registries/texture-registry.ts";
import { SoundRegistry } from "./registries/sound-registry.ts";
import { DynamicBuffer } from "./classes/dynamic-buffer.ts";
import { TerrainGenerator } from "./terrain-generator.ts";
import { ArenaBuffer } from "./classes/arena-buffer.ts";
import { PhysicsSystem } from "./physics-system.ts";
import { InputSystem } from "./input-system.ts";
import { Minimap } from "./classes/minimap.ts";
import { BYTES_PER_VERTEX, IMAGE_SIZE, } from "./constants.ts";
import { UISystem } from "./ui-system.ts";
import { Profiler } from "./profiler.ts";
import { Devices } from "./types.ts";
import { vec3 } from "wgpu-matrix";
import { Camera } from "./camera.ts";
import { update } from "./update.ts";
import { Player } from "./player.ts";
import { loadImage } from "./lib.ts";
import { State } from "./state.ts";
import { World } from "./world.ts";
import { Chunk } from "./chunk.ts";
import React from "react";
import ReactDOM from "react-dom/client";
import { Root } from "./react/root.tsx";


window.onload = main;



async function initDevices(): Promise<Devices> {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.id = "game";

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
  // TODO pass registries
  const root = document.createElement("div");
  document.body.appendChild(root);
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  );


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
  const player = new Player({
    creative: true,
    camera: new Camera({ canvas, active: true, position: vec3.create(-0.5, 78.5, 8) }),
  });

  const input = new InputSystem(canvas);

  const state: State = {
    canvas, context, adapter, device, depthTexture, audio,
    paused: true,
    time: {
      last: 0,
      dt: { cpu: 0.01, gpu: 0.01 },
      seconds: 0,
    },
    world: new World(new TerrainGenerator()),
    player,

    minimap: new Minimap(minimap_arrow),

    chunkBuffer: new ArenaBuffer(device, 2000 * 1024 * 1024, GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX, [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6], 64),

    indirectBuffer: new DynamicBuffer(device, GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST, 64),

    pipelines: [
      SKY_PIPELINE(device),
      MAIN_PIPELINE(device, textureview),
      OUTLINE_PIPELINE(device),
      DESTROY_PIPELINE(device, destroytextureview),
    ],

    compute: new ChunkBlocksComputePipeline(device),

    profiler: new Profiler(),
    input,
    physics: new PhysicsSystem(),
    ui: new UISystem(player, input),
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

  window.setInterval(() => {
    const prf = state.profiler;
    window.dispatchEvent(new CustomEvent<WindowEventMap["stats"]["detail"]>("stats", {
      detail: {
        time: state.time.seconds,
        player: {
          direction: state.player.direction,
          position: state.player.position,
          lookat: state.player.lookat,
          speed: state.player.velocity,
          biome: state.world.terraingenerator.getBiome(state.player.position[0], state.player.position[2]),
        },
        cpu: {
          averageFPS: 1 / prf.performance("cpu frame time").average(),
          lows: 1 / prf.performance("cpu frame time").max(5),
        },
        gpu: {
          averageFPS: 1 / prf.performance("gpu frame time").average(),
          lows: 1 / prf.performance("gpu frame time").max(5),
        },
        chunks: {
          loaded: state.world.chunks.size,
          rendered: state.world.rendered,
          queued: state.world.queue.size,
          avgGenTime: prf.performance("chunk generation").average(),
          memory: {
            usedBytes: state.chunkBuffer.stats().usedBytes,
            totalBytes: state.chunkBuffer.stats().capacityBytes,
          },
        },
        vertices: (() => {
          let vertices = 0;
          const chunks = state.world.chunks.values;

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            for (let face = 0; face < 6; face += 1) {
              vertices += chunk.allocations[face].size;
            }
          }

          return vertices / BYTES_PER_VERTEX;
        })(),
      }
    }));
  }, 250);

  requestAnimationFrame(timestamp => update(timestamp, state));
}
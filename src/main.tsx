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
import {
  BYTES_PER_VERTEX,
  CHUNK_SIZE,
  IMAGE_SIZE,
  RENDER_DISTANCE,
  TICKS_PER_SECOND,
} from "./constants.ts";
import { UISystem } from "./ui-system.ts";
import { Profiler } from "./profiler.ts";
import { BlockData, Devices, RegistryMessage } from "./types.ts";
import { vec3 } from "wgpu-matrix";
import { Camera } from "./camera.ts";
import { update } from "./update.ts";
import { render } from "./render.ts";
import { Player } from "./player.ts";
import { loadImage } from "./lib.ts";
import { State } from "./state.ts";
import { World } from "./world.ts";
import { Chunk } from "./chunk.ts";
import React from "react";
import ReactDOM from "react-dom/client";
import { Root } from "./react/root.tsx";
import { POST_PIPELINE } from "./pipeline-descriptors/post-pipeline.ts";
import { LVH } from "./classes/lvh.ts";
import { calculateSphereOffsets, MESH } from "./mesh.ts";
import { BlockStateRegistry } from "./registries/blockstate-registry.ts";
import { GHOST_PIPELINE } from "./pipeline-descriptors/ghost-pipeline.ts";
import { RegEntry, Registry } from "./registry.ts";
import { Texture, TextureData, TextureName } from "./texture.ts";
import { RegistryManager } from "./registry-manager.ts";
import {
  BlockProperties,
  BlockProperty,
  BlockPropertyNames,
} from "./block-properties.ts";
import { BlockID, BlockState, BlockStateData } from "./blockstate.ts";

window.onload = main;

async function main() {
  // TODO pass registries
  const root = document.createElement("div");
  document.body.appendChild(root);
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  );

  const { canvas, context, adapter, device, audio } = await initDevices();

  BlockStateRegistry.build();
  await TextureRegistry.awaitImages();
  await SoundRegistry.awaitSounds(audio);
  const textures = TextureRegistry.getAll().map<ImageBitmap>((t) => t.bitmap!);
  const texturearray = await createTextureArray(
    device,
    IMAGE_SIZE,
    IMAGE_SIZE,
    textures,
  );

  const destroytextures = TextureRegistry.getAll().map<ImageBitmap>(
    (texture) => texture.bitmap!,
  );
  const destroytexturearray = await createTextureArray(
    device,
    IMAGE_SIZE,
    IMAGE_SIZE,
    destroytextures,
  );

  // Create depth texture once
  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const outlineTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });

  const minimap_arrow = await createImageBitmap(
    await loadImage("/ui/minimap-arrow.png"),
  );

  // CREATE STATE
  const player = new Player({
    creative: true,
    camera: new Camera({
      canvas,
      active: true,
      position: vec3.create(-0.5, 64.5, 8),
    }),
  });

  const input = new InputSystem(canvas);

  // TODO resizing kills texture

  const state: State = {
    canvas,
    context,
    adapter,
    device,
    depthTexture,
    outlineTexture,
    audio,
    paused: true,
    time: {
      last: 0,
      dt: { cpu: 0.01, gpu: 0.01 },
      seconds: 0,
    },
    time_since_last_update: 0,
    world: new World(new TerrainGenerator()),
    player,
    alpha: 0,
    render_distance: RENDER_DISTANCE,
    sphere_offsets: calculateSphereOffsets(RENDER_DISTANCE),
    gpuIndrectionChunkMap: new Uint32Array((2 * RENDER_DISTANCE + 1) ** 3), // Maps chunk index to indirection buffer index
    gpuIndirectionBufferOrigin: vec3.floor(
      vec3.divScalar(player.position, CHUNK_SIZE),
    ),
    minimap: new Minimap(minimap_arrow),

    chunkBuffer: new ArenaBuffer(
      device,
      1000 * 1024 * 1024,
      GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
      [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6],
      64,
    ),

    lvh: new LVH(device),

    indirectBuffer: new DynamicBuffer(
      device,
      GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
      64,
    ),

    pipelines: [
      SKY_PIPELINE(device),
      MAIN_PIPELINE(device, texturearray.createView()),
      OUTLINE_PIPELINE(device),
      DESTROY_PIPELINE(device, destroytexturearray.createView()),
      POST_PIPELINE(device, outlineTexture.createView()),
      GHOST_PIPELINE(device, texturearray.createView()),
    ],

    registrymanager: RegistryManager.create(),
    profiler: new Profiler(),
    input,
    physics: new PhysicsSystem(),
    ui: new UISystem(player, input),
  };

  await registerTextures(state);
  registerBlocks(state);
  registerBlockstates(state);

  // Send registries to workers
  for (let w = 0; w < state.world.workers.length; w++) {
    const worker = state.world.workers[w];
    worker.postMessage({
      type: "registries",
      manager: state.registrymanager,
    } as RegistryMessage);
  }

  Chunk.chunkBuffer = state.chunkBuffer;

  // LISTENERS
  window.onresize = () => {
    // Update canvas(es)
    canvas.width = Math.floor(window.devicePixelRatio * window.innerWidth);
    canvas.height = Math.floor(window.devicePixelRatio * window.innerHeight);
    // TODO update minimap as well

    // Update context
    /*context.configure({
      device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: "opaque",
      //size: [canvas.width, canvas.height],
    });*/

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

    //state.outlineTexture.destroy();
    const outlineTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    state.outlineTexture = outlineTexture;
  };

  window.setInterval(() => {
    const prf = state.profiler;
    window.dispatchEvent(
      new CustomEvent<WindowEventMap["stats"]["detail"]>("stats", {
        detail: {
          time: state.time.seconds,
          player: {
            direction: state.player.direction,
            position: state.player.position,
            lookat: state.player.lookat,
            speed: state.player.velocity,
            biome: state.world.terraingenerator.getBiome(
              state.player.position[0],
              state.player.position[2],
            ),
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
        },
      }),
    );
  }, 250);

  loop(state);
}

function loop(state: State) {
  const now = performance.now();
  state.time.dt.cpu = (now - state.time.last) / 1000;
  state.time.seconds += state.time.dt.cpu;
  state.world.seconds += state.time.dt.cpu;
  state.time.last = now;
  state.time_since_last_update += state.time.dt.cpu;

  if (state.time_since_last_update > 1 / TICKS_PER_SECOND) {
    update(state);
    state.time_since_last_update -= 1 / TICKS_PER_SECOND;
  }

  state.alpha = state.time_since_last_update * TICKS_PER_SECOND;
  render(state);

  requestAnimationFrame(() => loop(state));
}

async function initDevices(): Promise<Devices> {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.id = "game";

  const context = canvas.getContext("webgpu");
  if (!context)
    throw new Error("WebGPU context of canvas could not be retreived.");

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("Could not request GPU adapter.");

  const device = await adapter.requestDevice({
    requiredLimits: {
      maxBufferSize: adapter.limits.maxBufferSize,
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
    },

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

async function createTextureArray(
  device: GPUDevice,
  width: number,
  height: number,
  images: ImageBitmap[],
): Promise<GPUTexture> {
  const texture = device.createTexture({
    size: {
      width: width,
      height: height,
      depthOrArrayLayers: images.length,
    },
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
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

async function registerTextures(state: State) {
  RegistryManager.register(state.registrymanager, "textures", [
    await Texture.create("/blocks/air.png"),
    await Texture.create("/blocks/andesite.png"),
    await Texture.create("/blocks/azalea_leaves.png"),
    await Texture.create("/blocks/basalt.png"),
    await Texture.create("/blocks/blackstone.png"),
    await Texture.create("/blocks/calcite.png"),
    await Texture.create("/blocks/clay.png"),
    await Texture.create("/blocks/coal_ore.png"),
    await Texture.create("/blocks/coarse_dirt.png"),
    await Texture.create("/blocks/cobblestone.png"),
    await Texture.create("/blocks/copper_ore.png"),
    await Texture.create("/blocks/crafting_table_front.png"),
    await Texture.create("/blocks/crafting_table_side.png"),
    await Texture.create("/blocks/crafting_table_top.png"),
    await Texture.create("/blocks/deepslate_coal_ore.png"),
    await Texture.create("/blocks/deepslate_copper_ore.png"),
    await Texture.create("/blocks/deepslate_diamond_ore.png"),
    await Texture.create("/blocks/deepslate_emerald_ore.png"),
    await Texture.create("/blocks/deepslate_gold_ore.png"),
    await Texture.create("/blocks/deepslate_iron_ore.png"),
    await Texture.create("/blocks/deepslate_lapis_ore.png"),
    await Texture.create("/blocks/deepslate_redstone_ore.png"),
    await Texture.create("/blocks/deepslate.png"),
    await Texture.create("/blocks/diamond_ore.png"),
    await Texture.create("/blocks/diorite.png"),
    await Texture.create("/blocks/dirt.png"),
    await Texture.create("/blocks/dripstone.png"),
    await Texture.create("/blocks/emerald_ore.png"),
    await Texture.create("/blocks/flowering_azalea.png"),
    await Texture.create("/blocks/glass.png"),
    await Texture.create("/blocks/blue_glass.png"),
    await Texture.create("/blocks/gold_ore.png"),
    await Texture.create("/blocks/granite.png"),
    await Texture.create("/blocks/grass_side.png"),
    await Texture.create("/blocks/grass_top.png"),
    await Texture.create("/blocks/gravel.png"),
    await Texture.create("/blocks/iron_ore.png"),
    await Texture.create("/blocks/lapis_ore.png"),
    await Texture.create("/blocks/moss_block.png"),
    await Texture.create("/blocks/mossy_cobblestone.png"),
    await Texture.create("/blocks/mud.png"),
    await Texture.create("/blocks/oak_log_side.png"),
    await Texture.create("/blocks/oak_log_top.png"),
    await Texture.create("/blocks/oak_planks.png"),
    await Texture.create("/blocks/podzol.png"),
    await Texture.create("/blocks/red_sand.png"),
    await Texture.create("/blocks/redstone_ore.png"),
    await Texture.create("/blocks/sand.png"),
    await Texture.create("/blocks/sandstone.png"),
    await Texture.create("/blocks/snow.png"),
    await Texture.create("/blocks/stone.png"),
    await Texture.create("/blocks/tuff.png"),
    await Texture.create("/ui/destroy_stage_0.png"),
    await Texture.create("/ui/destroy_stage_1.png"),
    await Texture.create("/ui/destroy_stage_2.png"),
    await Texture.create("/ui/destroy_stage_3.png"),
    await Texture.create("/ui/destroy_stage_4.png"),
    await Texture.create("/ui/destroy_stage_5.png"),
    await Texture.create("/ui/destroy_stage_6.png"),
    await Texture.create("/ui/destroy_stage_7.png"),
    await Texture.create("/ui/destroy_stage_8.png"),
    await Texture.create("/ui/destroy_stage_9.png"),
  ]);
}

function registerBlocks(state: State) {
  RegistryManager.register(state.registrymanager, "blocks", [
    {
      name: "air",
      display: "Air",
      meshID: MESH.CUBE,
      material: "none",
      tool: "none",
      properties: [],
      hardness: 0,
      textures: ["air" as TextureName],
    },
    {
      name: "andesite",
      display: "Andesite",
      meshID: MESH.CUBE,
      hardness: 3,
      tool: "pickaxe",
      material: "stone",
      textures: ["andesite" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "azalea_leaves",
      display: "Azalea Leaves",
      meshID: MESH.OPAQUE_CUBE,
      hardness: 3,
      tool: "none",
      material: "leaves",
      textures: ["azalea_leaves" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "basalt",
      display: "Basalt",
      meshID: MESH.CUBE,
      hardness: 3,
      tool: "pickaxe",
      material: "stone",
      textures: ["basalt" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "blackstone",
      display: "Blackstone",
      meshID: MESH.CUBE,
      hardness: 3,
      tool: "pickaxe",
      material: "stone",
      textures: ["blackstone" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "calcite",
      display: "Calcite",
      meshID: MESH.CUBE,
      hardness: 3,
      tool: "pickaxe",
      material: "stone",
      textures: ["calcite" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "clay",
      display: "Clay",
      meshID: MESH.CUBE,
      hardness: 3,
      tool: "shovel",
      material: "dirt",
      textures: ["clay" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "coal_ore",
      display: "Coal Ore",
      meshID: MESH.CUBE,
      hardness: 3,
      tool: "pickaxe",
      material: "stone",
      textures: ["coal_ore" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "coarse_dirt",
      display: "Coarse Dirt",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "dirt",
      tool: "shovel",
      textures: ["coarse_dirt" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "cobblestone",
      display: "Cobblestone",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["cobblestone" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "copper_ore",
      display: "Copper Ore",
      meshID: MESH.CUBE,
      hardness: 3,
      tool: "pickaxe",
      material: "stone",
      textures: ["copper_ore" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "crafting_table",
      display: "Crafting Table",
      meshID: MESH.CUBE,
      hardness: 3,
      tool: "axe",
      material: "wood",
      textures: [
        "crafting_table_side" as TextureName,
        "crafting_table_side" as TextureName,
        "crafting_table_top" as TextureName,
        "crafting_table_side" as TextureName,
        "crafting_table_top" as TextureName,
        "crafting_table_side" as TextureName,
      ],
      properties: [BlockProperties.orientation],
    },
    {
      name: "deepslate_coal_ore",
      display: "Deepslate Coal Ore",
      meshID: MESH.CUBE,
      hardness: 3,
      tool: "pickaxe",
      material: "stone",
      textures: ["deepslate_coal_ore" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "deepslate_copper_ore",
      display: "Deepslate Copper Ore",
      meshID: MESH.CUBE,
      hardness: 3,
      tool: "pickaxe",
      material: "stone",
      textures: ["deepslate_copper_ore" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "deepslate_diamond_ore",
      display: "Deepslate Diamond Ore",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["deepslate_diamond_ore" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "deepslate_emerald_ore",
      display: "Deepslate Emerald Ore",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["deepslate_emerald_ore" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "deepslate_gold_ore",
      display: "Deepslate Gold Ore",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["deepslate_gold_ore" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "deepslate_iron_ore",
      display: "Deepslate Iron Ore",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["deepslate_iron_ore" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "deepslate_lapis_ore",
      display: "Deepslate Lapis Lazuli Ore",
      meshID: MESH.CUBE,
      hardness: 3,
      tool: "pickaxe",
      material: "stone",
      textures: ["deepslate_lapis_ore" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "deepslate_redstone_ore",
      display: "Deepslate Redstone Ore",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["deepslate_redstone_ore" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "deepslate",
      display: "Deepslate",
      meshID: MESH.CUBE,
      hardness: 3,
      tool: "pickaxe",
      material: "stone",
      textures: ["deepslate" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "diorite",
      display: "Diorite",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["diorite" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "dirt",
      display: "Dirt",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "dirt",
      tool: "shovel",
      textures: ["dirt" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "dripstone",
      display: "Dripstone",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["dripstone" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "emerald_ore",
      display: "Emerald Ore",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["emerald_ore" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "flowering_azalea",
      display: "Flowering Azalea",
      meshID: MESH.OPAQUE_CUBE,
      hardness: 3,
      material: "leaves",
      tool: "none",
      textures: ["flowering_azalea" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "glass",
      display: "Glass",
      meshID: MESH.OPAQUE_CUBE,
      hardness: 3,
      material: "glass",
      tool: "none",
      textures: ["glass" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "blue_glass",
      display: "Blue Glass",
      meshID: MESH.CUBE,
      hardness: 3,
      tool: "none",
      material: "glass",
      textures: ["blue_glass" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "gold_ore",
      display: "Gold ore",
      meshID: MESH.CUBE,
      hardness: 3,
      tool: "pickaxe",
      material: "stone",
      textures: ["gold_ore" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "granite",
      display: "Granite",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["granite" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "grass_block",
      display: "Grass Block",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "dirt",
      tool: "shovel",
      textures: [
        "grass_side" as TextureName,
        "grass_side" as TextureName,
        "grass_top" as TextureName,
        "dirt" as TextureName,
        "grass_side" as TextureName,
        "grass_side" as TextureName,
      ],
      properties: [BlockProperties.orientation],
    },
    {
      name: "gravel",
      display: "Gravel",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "dirt",
      tool: "shovel",
      textures: ["gravel" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "iron_ore",
      display: "Iron Ore",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["iron_ore" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "lapis_ore",
      display: "Lapis Lazuli Ore",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["lapis_ore" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "moss_block",
      display: "Moss Block",
      meshID: MESH.CUBE,
      hardness: 3,
      tool: "hoe",
      textures: ["moss_block" as TextureName],
      properties: [BlockProperties.orientation],
      material: "dirt",
    },
    {
      name: "mossy_cobblestone",
      display: "Mossy Cobblestone",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["mossy_cobblestone" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "mud",
      display: "Mud",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "dirt",
      tool: "shovel",
      textures: ["mud" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "oak_log",
      display: "Oak Log",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "wood",
      tool: "axe",
      textures: [
        "oak_log_side" as TextureName,
        "oak_log_side" as TextureName,
        "oak_log_top" as TextureName,
        "oak_log_top" as TextureName,
        "oak_log_side" as TextureName,
        "oak_log_side" as TextureName,
      ],
      properties: [BlockProperties.orientation],
    },
    {
      name: "oak_fence",
      display: "Oak Fence",
      meshID: MESH.FENCE,
      hardness: 3,
      material: "wood",
      tool: "axe",
      textures: ["oak_planks" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "oak_slab",
      display: "Oak Slab",
      meshID: MESH.SLAB,
      hardness: 3,
      material: "wood",
      tool: "axe",
      textures: ["oak_planks" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "oak_stairs",
      display: "Oak Stairs",
      meshID: MESH.STAIRS,
      hardness: 3,
      material: "wood",
      tool: "axe",
      textures: ["oak_planks" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "podzol",
      display: "Podzol",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "dirt",
      tool: "shovel",
      textures: ["podzol" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "red_sand",
      display: "Red Sand",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "sand",
      tool: "shovel",
      textures: ["red_sand" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "redstone_ore",
      display: "Redstone Ore",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["redstone_ore" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "sand",
      display: "Sand",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "sand",
      tool: "shovel",
      textures: ["sand" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "sandstone",
      display: "Sandstone",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["sandstone" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "snow",
      display: "Snow Block",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "sand",
      tool: "shovel",
      textures: ["snow" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "stone",
      display: "Stone",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      tool: "pickaxe",
      textures: ["stone" as TextureName],
      properties: [BlockProperties.orientation],
    },
    {
      name: "tuff",
      display: "Tuff",
      meshID: MESH.CUBE,
      hardness: 3,
      material: "stone",
      textures: ["tuff" as TextureName],
      tool: "pickaxe",
      properties: [BlockProperties.orientation],
    },
  ]);
}

function registerBlockstates(state: State) {
  const blocks = Registry.getAll(state.registrymanager.blocks, "ID");
  const entries: BlockStateData[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const props = block.properties;
    const combinations = BlockState.getAllCombinations(props);

    for (let c = 0; c < combinations.length; c++) {
      entries.push({
        blockID: block.ID as BlockID,
        hash: BlockState.encode(combinations[c]),
        properties: combinations[c],
      });
    }
  }

  RegistryManager.register(state.registrymanager, "blockstates", entries);
}

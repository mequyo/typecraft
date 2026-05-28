import { CHUNK_SIZE, TICKS_PER_SECOND } from "./constants";
import { vec3 } from "wgpu-matrix";
import { State } from "./state";
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { OAK_SLAB } from "./registries/blocks";
import { MOUSE } from "./input-system";
import { PlayerSystem } from "./player-system";

/**
 * This function gets called every frame, updates state and renders it.
 * @param timestamp Timestamp of the application
 * @param state State of the game that holds all information
 */
export function update(state: State) {
  const prof = state.profiler;
  const player = state.player;
  const dt = 1 / TICKS_PER_SECOND;

  state.world.queueChunks(state.player, state); // Queues chunks around the player and generates one each tick

  prof.measure("chunk culling", () => state.world.filterChunks(state.player));

  // PLACE BLOOK IF RIGHT CLICKED
  if (state.input.mouse.clicked[MOUSE.RIGHT] && player.lookat) {
    const position = vec3.sub(player.lookat, state.player.placeoffset);
    state.world.addBlock(
      position,
      BlockStateRegistry.encode(OAK_SLAB.ID, {
        orientation: Math.floor(Math.random() * 24),
      }),
    ); // TODO actually set orientation based on viewing direction
  }

  // damage block if lookat and left click
  const left = state.input.mouse.buttons[MOUSE.LEFT];
  if (!state.player.creative && left && player.lookat) {
    const look = player.lookat;
    state.world.damageBlock(look[0], look[1], look[2], dt);
  }

  prof.measure("physics", () =>
    state.physics.tick(state.input, state.player, dt, state.world),
  );

  PlayerSystem.updateLookat(state.player, state.world);

  state.gpuIndirectionBufferOrigin = vec3.floor(
    vec3.divScalar(player.position, CHUNK_SIZE),
  );
}

export function render(state: State) {
  const start = performance.now();
  const prof = state.profiler;
  const context = state.context;
  const device = state.device;
  const width = state.canvas.width;
  const height = state.canvas.height;

  prof.add("cpu frame time", state.time.dt.cpu);

  state.player.tick(state.input); // CAMERA MOVEMENT
  prof.measure("ui", () => state.ui.tick(state.input, state));
  state.input.flush(true, true);

  // MINIMAP
  prof.measure("minimap", () =>
    state.minimap.render(state.player, state.world.regions),
  );

  // RENDER PIPELINES
  prof.measure("pipeline updates", () => {
    for (const pipeline of state.pipelines) pipeline.update(state);
  });

  const encoder = device.createCommandEncoder({ label: "Command Encoder" });

  const swapchainPass = encoder.beginRenderPass({
    label: "Swapchain Renderpass",
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: [109 / 256, 170 / 256, 255 / 256, 256 / 256],
        loadOp: "clear",
        storeOp: "store",
      },
    ],
    depthStencilAttachment: {
      view: state.depthTexture.createView(),
      depthLoadOp: "clear",
      depthStoreOp: "store",
      depthClearValue: 1.0,
    },
  });

  swapchainPass.setViewport(0, 0, width, height, 0, 1);

  // DRAW world (swapchain), destroy texture over blocks and sky
  prof.measure("pipeline draw", () => {
    state.pipelines[0].draw(swapchainPass, state.pipelines[0], state); // SKY_PIPELINE(device),
    state.pipelines[1].draw(swapchainPass, state.pipelines[1], state); // MAIN_PIPELINE(device, textureview),
    state.pipelines[3].draw(swapchainPass, state.pipelines[3], state); // DESTROY_PIPELINE(device, destroytextureview),
  });

  swapchainPass.end();

  // Draw selected block's mesh on separate texture (outlinetexture)
  const outlinePass = encoder.beginRenderPass({
    label: "Outline Renderpass",
    colorAttachments: [
      {
        view: state.outlineTexture.createView(),
        loadOp: "clear",
        storeOp: "store",
        clearValue: [0, 0, 0, 0],
      },
    ],
    depthStencilAttachment: {
      view: state.depthTexture.createView(),
      depthLoadOp: "load", // reuse existing depth
      depthStoreOp: "store",
    },
  });
  outlinePass.setViewport(0, 0, state.canvas.width, state.canvas.height, 0, 1);
  state.pipelines[2].draw(outlinePass, state.pipelines[2], state); // Outline Pipeline
  outlinePass.end();

  // Draw outline texture onto swapchain texture
  const postPass = encoder.beginRenderPass({
    label: "Post Renderpass",
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        loadOp: "load",
        storeOp: "store",
      },
    ],
  });
  postPass.setViewport(0, 0, state.canvas.width, state.canvas.height, 0, 1);
  state.pipelines[4].draw(postPass, state.pipelines[4], state); // post processing pipeline
  postPass.end();

  device.queue.submit([encoder.finish()]);
  device.queue.onSubmittedWorkDone().then(() => {
    // TODO find a way to reliably calculate GPU times
    const end = performance.now();
    state.time.dt.gpu = (end - start) / 1000;
    prof.add("gpu frame time", (end - start) / 1000);
  });
}

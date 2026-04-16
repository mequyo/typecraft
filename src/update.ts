import {
  MINIMAP_MAX_ZOOM,
  MINIMAP_MIN_ZOOM,
} from "./constants";
import { vec3 } from "wgpu-matrix";
import { State } from "./state";
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { OAK_SLAB } from "./registries/blocks";
import { MOUSE } from "./input-system";
import { PlayerSystem } from "./player-system";
import { Profiler } from "./profiler";

/**
 * This function gets called every frame, updates state and renders it.
 * @param timestamp Timestamp of the application
 * @param state State of the game that holds all information
 */
export async function update(timestamp: DOMHighResTimeStamp, state: State) {
  let start = performance.now();

  const now = performance.now();
  state.time.dt.cpu = (now - state.time.last) / 1000;
  state.performance.cpu.push((now - state.time.last) / 1000);
  state.time.seconds += state.time.dt.cpu;
  state.world.seconds += state.time.dt.cpu;
  state.time.last = now;

  const player = state.player;
  const dt = state.time.dt.cpu;

  state.world.queueChunks(state.player, state); // Queues chunks around the player and generates one each tick


  Profiler.measure("chunk culling", () => state.world.filterChunks(state.player));


  if (state.input.keypresses["c"])
    state.player.creative = !state.player.creative;

  if (state.input.keypresses["+"] && state.minimap.zoom < MINIMAP_MAX_ZOOM) {
    state.minimap.zoom *= 2;
  }

  if (state.input.keypresses["-"] && state.minimap.zoom > MINIMAP_MIN_ZOOM) {
    state.minimap.zoom /= 2;
  }

  state.player.tick(state.input); // CAMERA MOVEMENT

  // PLACE BLOOK IF RIGHT CLICKED
  if (state.input.mouse.clicked[MOUSE.RIGHT] && player.lookat) {
    const position = vec3.sub(player.lookat, state.player.placeoffset);
    state.world.addBlock(
      position,
      BlockStateRegistry.encode(OAK_SLAB.ID, Math.floor(Math.random() * 24)),
    ); // TODO actually set orientation based on viewing direction
  }

  // ========================= MOVEMENT ===============================================================================

  Profiler.measure("physics", () => state.physics.tick(state.input, state.player, dt, state.world));
  Profiler.measure("ui", () => state.ui.tick(state.input, state));

  PlayerSystem.updateLookat(state.player, state.world);

  // damage block if lookat and left click
  if (
    !state.player.creative &&
    state.input.mouse.buttons[MOUSE.LEFT] &&
    player.lookat
  ) {
    state.world.damageBlock(
      player.lookat[0],
      player.lookat[1],
      player.lookat[2],
      dt,
    );
  }

  await render(state);

  state.input.flush();

  requestAnimationFrame((timestamp) => update(timestamp, state));
}



async function render(state: State) {
  let start = performance.now();

  const context = state.context;
  const device = state.device;

  // MINIMAP
  await Profiler.measure("minimap", () => state.minimap.render(state.world.chunks, state.player, state.world.regions));

  // RENDER PIPELINES

  Profiler.measure("pipeline updates", () => { for (const pipeline of state.pipelines) pipeline.update(state) });


  const passdescriptor: GPURenderPassDescriptor = {
    label: "Renderpass",
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
  };

  const encoder = device.createCommandEncoder({ label: "Command Encoder" });
  const pass = encoder.beginRenderPass(passdescriptor);

  pass.setViewport(0, 0, state.canvas.width, state.canvas.height, 0, 1);

  // DRAW ALL PIPELINES
  Profiler.measure("pipeline draw", () => {
    for (let i = 0; i < state.pipelines.length; i++) {
      state.pipelines[i].draw(pass, state.pipelines[i], state);
    }
  })

  // FINISH WORK
  pass.end();
  device.queue.submit([encoder.finish()]);

  device.queue.onSubmittedWorkDone().then(() => {
    // TODO find a way to reliably calculate GPU times
    const end = performance.now();
    state.time.dt.gpu = (end - start) / 1000;
    state.performance.gpu.push((end - start) / 1000);
  });
}

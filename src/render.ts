import { State } from "./state";

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
  state.input.flush({ mouse_movement: true, keypresses: true });

  // MINIMAP
  prof.measure("minimap", () =>
    state.minimap.render(state.player, state.world.regions),
  );

  // RENDER PIPELINES
  prof.measure("pipeline updates", () => {
    for (const pipeline of state.pipelines) pipeline.update(state);
  });

  const encoder = device.createCommandEncoder({ label: "Command Encoder" });

  // COMPUTE SHADERS, for now just frustum culling
  prof.measure("culling", () => {
    //state.world.updateFrustumPlanes(state.player); // Automatically happens
    device.queue.writeBuffer(
      state.cullResources.planesBuffer,
      0,
      state.world.planes.buffer,
    );

    const origin = state.gpuIndirectionBufferOrigin;
    device.queue.writeBuffer(
      state.cullResources.originBuffer,
      0,
      new Int32Array([origin[0], origin[1], origin[2], state.render_distance]),
    );

    const cullPass = encoder.beginComputePass({ label: "Culling Pass" });
    cullPass.setPipeline(state.cullResources.pipeline);
    cullPass.setBindGroup(0, state.cullResources.bindGroup);
    cullPass.dispatchWorkgroups(
      Math.ceil(state.cullResources.maxChunkSlots / 64),
    );
    cullPass.end();
  });

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
    state.pipelines[5].draw(swapchainPass, state.pipelines[5], state); // GHOST_PIPELINE(device, texturearrayview),
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

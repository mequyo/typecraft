import { CAMERA_HEIGHT, CHUNK_SIZE, GRAVITY, GROUND_FRICTION, JUMP_FORCE, MAX_HORIZONTAL_VELOCITY, PLAYER_BASE_SPEED, PLAYER_HEIGHT, PLAYER_REACH, PLAYER_WIDTH, RENDER_DISTANCE } from "./constants";
import { collides, dda, vec3ToLocalChunk } from "./lib";
import { vec3 } from "wgpu-matrix";
import { State } from "./state";
import { Stats } from "./classes/stats";
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { AIR } from "./registries/blocks";
import { SPHERE_OFFSETS } from "./mesh";


/**
 * This function gets called every frame, updates state and renders it.
 * @param state State of the game that holds all information
 */
export async function update(state: State) {
  const now = performance.now();
  state.time.dt.cpu = (now - state.time.last) / 1000;
  state.performance.cpu.push((now - state.time.last) / 1000);
  state.time.seconds += state.time.dt.cpu;
  state.world.seconds += state.time.dt.cpu;
  state.time.last = now;

  const context = state.context;
  const device = state.device;
  const player = state.player;
  const dt = state.time.dt.cpu;

  // Generate chunks within the vicinity of the player
  const playerChunkPos = vec3.floor(vec3.divScalar(player.position, CHUNK_SIZE));

  for (let i = 0; i < SPHERE_OFFSETS.length; i += 1) {
    const chunkpos = vec3.add(playerChunkPos, SPHERE_OFFSETS[i]);

    state.world.queueChunk(device, chunkpos, state.time.seconds, state.minimap.zoom, state);
  }

  state.world.generateChunk(device, state.time.seconds, state);

  // TODO Dequeue chunks that are too far away

  // ========================= MOVEMENT ===============================================================================

  const ground_friction_per_second = Math.pow(GROUND_FRICTION, 1 / dt);

  let move_dir = vec3.create(0, 0, 0);
  if (state.keys["w"]) move_dir = vec3.add(move_dir, vec3.create(player.direction[0], 0, player.direction[2]));
  if (state.keys["s"]) move_dir = vec3.sub(move_dir, vec3.create(player.direction[0], 0, player.direction[2]));
  if (state.keys["d"]) move_dir = vec3.add(move_dir, vec3.create(player.right[0], 0, player.right[2]));
  if (state.keys["a"]) move_dir = vec3.sub(move_dir, vec3.create(player.right[0], 0, player.right[2]));
  move_dir = vec3.normalize(move_dir);

  // Horizontal velocity update
  player.velocity = vec3.addScaled(player.velocity, move_dir, PLAYER_BASE_SPEED);// player.velocity.add(move_dir.mul(PLAYER_BASE_SPEED));

  if (player.creative) {
    // Go down if control is pressed and up if space is pressed
    if (state.keys[" "]) player.velocity[1] -= JUMP_FORCE * dt * GRAVITY[1];
    if (state.keys["control"]) player.velocity[1] += JUMP_FORCE * dt * GRAVITY[1];
  } else {
    // Apply gravity and jump if space is pressed
    player.velocity = vec3.addScaled(player.velocity, GRAVITY, dt);

    if (state.keys[" "] && player.grounded) player.velocity[1] += JUMP_FORCE;
  }

  // Apply friction TODO less movement in air
  const friction_factor = Math.pow(ground_friction_per_second, dt);
  player.velocity[0] *= friction_factor;
  player.velocity[2] *= friction_factor;
  if (player.creative) player.velocity[1] *= friction_factor;

  // Clamp horizontal velocity
  const speed = vec3.length(vec3.create(player.velocity[0], 0, player.velocity[2]));
  //const speed = player.velocity.horizontal().norm();
  if (speed > MAX_HORIZONTAL_VELOCITY) {
    player.velocity[0] *= MAX_HORIZONTAL_VELOCITY / speed;
    player.velocity[2] *= MAX_HORIZONTAL_VELOCITY / speed;
  }

  // Stepwise axis resolution
  let collision = null;

  player.grounded = false;
  player.position[1] += player.velocity[1] * dt;
  collision = collides(player.position, state.world);
  if (collision) {
    if (player.velocity[1] > 0) {
      player.position[1] = collision[1] - PLAYER_HEIGHT + CAMERA_HEIGHT - 0.001;
    } else {
      player.position[1] = collision[1] + 1 + CAMERA_HEIGHT + 0.001;
      player.grounded = true;
    }
    player.velocity[1] = 0;
  }

  player.position[0] += player.velocity[0] * dt;
  collision = collides(player.position, state.world);
  if (collision) {
    if (player.velocity[0] > 0) {
      player.position[0] = collision[0] - PLAYER_WIDTH / 2 - 0.001;
    } else {
      player.position[0] = collision[0] + 1 + PLAYER_WIDTH / 2 + 0.001;
    }
    player.velocity[0] = 0;
  }

  player.position[2] += player.velocity[2] * dt;
  collision = collides(player.position, state.world);
  if (collision) {
    if (player.velocity[2] > 0) {
      player.position[2] = collision[2] - PLAYER_WIDTH / 2 - 0.001;
    } else {
      player.position[2] = collision[2] + 1 + PLAYER_WIDTH / 2 + 0.001;
    }
    player.velocity[2] = 0;
  }


  // Zooming like a spyglass
  if (state.keys["z"]) {
    state.player.fov = Math.PI / 10
  } else {
    state.player.fov = Math.PI / 2
  }

  // Update chunk position of player


  // ========================== LOOK AT

  // TODO some blocks arent full blocks
  state.player.lookat = null;
  const positions = dda(player.eye, player.direction, PLAYER_REACH);

  for (const hit of positions) {
    const { pos, face } = hit;
    const offset = vec3.floor(vec3.divScalar(pos, CHUNK_SIZE)); // chunk location
    const chunk = state.world.getChunk(offset);

    if (!chunk) continue;

    const local = vec3ToLocalChunk(pos); // TODO replace with addScalar
    const blockstate = chunk.get(local[0], local[1], local[2]);

    if (BlockStateRegistry.decode(blockstate).block == AIR.ID) continue;

    state.player.lookat = pos;
    state.player.placeoffset = face;
    break;
  }


  //if (Math.random() > 0.996) {
  //  state.compute.dispatch(state.compute, new Float32Array([CHUNK_SIZE, 0, 0, 0]));
  // }



  // damage block if lookat and left click
  if (!state.player.creative && state.mouse.left && player.lookat) {
    state.world.damageBlock(player.lookat[0], player.lookat[1], player.lookat[2], dt);
  }


  await state.minimap.render(state.world.chunks, state.player);



  for (const pipeline of state.pipelines) pipeline.update(state);


  // UPDATE BIND GROUPS IF NEEDED
  //Object.values(state.pipelines).forEach(pipe => pipe.updateBuffers());


  const passdescriptor: GPURenderPassDescriptor = {
    label: "Renderpass",
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: [109 / 256, 170 / 256, 255 / 256, 256 / 256],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
    depthStencilAttachment: {
      view: state.depthTexture.createView(),
      depthLoadOp: "clear",
      depthStoreOp: "store",
      depthClearValue: 1.0,
    }
  };


  // CREATE RENDER PASS

  const encoder = device.createCommandEncoder({ label: "Command Encoder" });
  const pass = encoder.beginRenderPass(passdescriptor);

  pass.setViewport(0, 0, state.canvas.width, state.canvas.height, 0, 1);

  // DRAW ALL PIPELINES
  for (let i = 0; i < state.pipelines.length; i++) {
    state.pipelines[i].draw(pass, state.pipelines[i], state);
  }

  // FINISH WORK
  pass.end();
  device.queue.submit([encoder.finish()]);

  device.queue.onSubmittedWorkDone().then(() => {
    const end = performance.now();
    state.time.dt.gpu = (end - start) / 1000;
    state.performance.gpu.push((end - start) / 1000);
  });


  // COMPUTE TEST
  if (Math.random() > 0.995) {
    //state.compute.dispatch(device);
  }



  Stats.update(state);

  const start = performance.now();
  requestAnimationFrame(() => update(state));
}
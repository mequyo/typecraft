import { vec3 } from "wgpu-matrix";
import { InputSystem } from "./input-system";
import { Player } from "./player";
import {
  CAMERA_HEIGHT,
  GRAVITY,
  GROUND_FRICTION,
  JUMP_FORCE,
  MAX_HORIZONTAL_VELOCITY,
  PLAYER_BASE_SPEED,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
} from "./constants";
import { collides } from "./lib";
import { World } from "./world";
import { RegistryData } from "./registry";
import { BlockStateData } from "./blockstate";

// Works on inputs and world events like gravity
export class PhysicsSystem {
  // TODO query all entities with gravity, etc. instead of passing just player
  tick(
    input: InputSystem,
    player: Player,
    dt: number,
    world: World,
    reg: RegistryData<BlockStateData>,
  ) {
    const ground_friction_per_second = Math.pow(GROUND_FRICTION, 1 / dt);

    let move_dir = vec3.create(0, 0, 0);
    if (input.keys["w"])
      move_dir = vec3.add(
        move_dir,
        vec3.create(player.direction[0], 0, player.direction[2]),
      );
    if (input.keys["s"])
      move_dir = vec3.sub(
        move_dir,
        vec3.create(player.direction[0], 0, player.direction[2]),
      );
    if (input.keys["d"])
      move_dir = vec3.add(
        move_dir,
        vec3.create(player.right[0], 0, player.right[2]),
      );
    if (input.keys["a"])
      move_dir = vec3.sub(
        move_dir,
        vec3.create(player.right[0], 0, player.right[2]),
      );
    move_dir = vec3.normalize(move_dir);

    // Horizontal velocity update
    player.velocity = vec3.addScaled(
      player.velocity,
      move_dir,
      PLAYER_BASE_SPEED,
    );

    if (player.creative) {
      // Go down if control is pressed and up if space is pressed
      if (input.keys[" "]) player.velocity[1] -= JUMP_FORCE * dt * GRAVITY[1];
      if (input.keys["control"])
        player.velocity[1] += JUMP_FORCE * dt * GRAVITY[1];
    } else {
      // Apply gravity and jump if space is pressed
      player.velocity = vec3.addScaled(player.velocity, GRAVITY, dt);

      if (input.keys[" "] && player.grounded) player.velocity[1] += JUMP_FORCE;
    }

    // Apply friction TODO less movement in air
    const friction_factor = Math.pow(ground_friction_per_second, dt);
    player.velocity[0] *= friction_factor;
    player.velocity[2] *= friction_factor;
    if (player.creative) player.velocity[1] *= friction_factor;

    // Clamp horizontal velocity
    const speed = vec3.length(
      vec3.create(player.velocity[0], 0, player.velocity[2]),
    );

    if (speed > MAX_HORIZONTAL_VELOCITY) {
      player.velocity[0] *= MAX_HORIZONTAL_VELOCITY / speed;
      player.velocity[2] *= MAX_HORIZONTAL_VELOCITY / speed;
    }

    // resolve collisions
    this.resolve(player, world, dt, reg);
  }

  // stepwise axis resolution
  resolve(
    player: Player,
    world: World,
    dt: number,
    reg: RegistryData<BlockStateData>,
  ) {
    player.lastPosition = vec3.copy(player.position);
    player.grounded = false;

    for (let axis = 0; axis < 3; axis++) {
      player.position[axis] += player.velocity[axis] * dt;
      const hit = collides(player.position, world, reg);
      if (!hit) continue;

      if (player.velocity[axis] > 0) {
        const offset =
          axis == 1 ? CAMERA_HEIGHT - PLAYER_HEIGHT : -PLAYER_WIDTH / 2;
        player.position[axis] = hit[axis] + offset - 0.001;
      } else {
        const offset = axis == 1 ? CAMERA_HEIGHT : PLAYER_WIDTH / 2;
        player.position[axis] = hit[axis] + offset + 0.001 + 1;
        if (axis == 1) player.grounded = true;
      }

      player.velocity[axis] = 0;
    }
  }
}

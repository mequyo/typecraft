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

// Works on inputs and world events like gravity
export class PhysicsSystem {
  // TODO query all entities with gravity, etc. instead of passing just player
  tick(input: InputSystem, player: Player, dt: number, world: World) {
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
    this.resolve(player, world, dt);
  }

  // stepwise axis resolution
  resolve(player: Player, world: World, dt: number) {
    // Stepwise axis resolution
    let collision = null;

    player.grounded = false;
    player.position[1] += player.velocity[1] * dt;
    collision = collides(player.position, world);
    if (collision) {
      if (player.velocity[1] > 0) {
        player.position[1] =
          collision[1] - PLAYER_HEIGHT + CAMERA_HEIGHT - 0.001;
      } else {
        player.position[1] = collision[1] + 1 + CAMERA_HEIGHT + 0.001;
        player.grounded = true;
      }
      player.velocity[1] = 0;
    }

    player.position[0] += player.velocity[0] * dt;
    collision = collides(player.position, world);
    if (collision) {
      if (player.velocity[0] > 0) {
        player.position[0] = collision[0] - PLAYER_WIDTH / 2 - 0.001;
      } else {
        player.position[0] = collision[0] + 1 + PLAYER_WIDTH / 2 + 0.001;
      }
      player.velocity[0] = 0;
    }

    player.position[2] += player.velocity[2] * dt;
    collision = collides(player.position, world);
    if (collision) {
      if (player.velocity[2] > 0) {
        player.position[2] = collision[2] - PLAYER_WIDTH / 2 - 0.001;
      } else {
        player.position[2] = collision[2] + 1 + PLAYER_WIDTH / 2 + 0.001;
      }
      player.velocity[2] = 0;
    }
  }
}

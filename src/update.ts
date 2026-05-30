import { CHUNK_SIZE, TICKS_PER_SECOND } from "./constants";
import { vec3 } from "wgpu-matrix";
import { State } from "./state";
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { OAK_SLAB } from "./registries/blocks";
import { MOUSE } from "./input-system";
import { PlayerSystem } from "./player-system";
import { BlockRegistry } from "./registries/block-registry";
import { ORIENTATION } from "./mesh";

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

    try {
      let slot = player.hotbar[player.selectedSlot];
      const block = BlockRegistry.getByName(slot?.[1] || "empty slot").ID;

      if (slot) {
        slot[0] -= 1;
        if (slot[0] <= 0) player.hotbar[player.selectedSlot] = null;
        window.dispatchEvent(
          new CustomEvent<WindowEventMap["ui-update"]["detail"]>("ui-update", {
            detail: {
              inventory: state.player.inventory,
              hotbar: state.player.hotbar,
            },
          }),
        );
      }

      state.world.addBlock(
        position,
        BlockStateRegistry.encode(block, {
          orientation: ORIENTATION.NX_0,
        }),
      ); // TODO actually set orientation based on viewing direction
      // TODO don't place if placing into entities
    } catch (_) {
      // No block selected, placing doesn't work
    }
  }

  // damage block if lookat and left click
  const left = state.input.mouse.buttons[MOUSE.LEFT];
  if (!state.player.creative && left && player.lookat) {
    const look = player.lookat;
    state.world.damageBlock(look[0], look[1], look[2], dt, player);
  }

  prof.measure("physics", () =>
    state.physics.tick(state.input, state.player, dt, state.world),
  );

  PlayerSystem.updateLookat(state.player, state.world);

  state.gpuIndirectionBufferOrigin = vec3.floor(
    vec3.divScalar(player.position, CHUNK_SIZE),
  );

  state.input.flush({ button_presses: true });
}

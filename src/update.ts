import { CHUNK_SIZE, TICKS_PER_SECOND } from "./constants";
import { Vec3, vec3 } from "wgpu-matrix";
import { State } from "./state";
import { MOUSE } from "./input-system";
import { PlayerSystem } from "./player-system";
import { BlockRegistry } from "./registries/block-registry";
import { NORMAL_TO_ORIENTATION } from "./mesh";
import { BlockState } from "./blockstate";
import { useStore } from "./store";
import { Registry } from "./registry";

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
    const hit = state.world.raycast(
      { origin: player.eye, direction: player.direction },
      5.0,
    );

    if (hit) {
      const blockstatehash = state.world.getBlockState(hit.pos);
      const blockstate = Registry.get(
        state.registrymanager.blockstates,
        "ID",
        blockstatehash,
      );
      const name = blockstate.block.name;
      const use: undefined | ((pos: Vec3) => void) = state.block_use_map[name];

      if (use !== undefined && !state.input.keys["shift"]) {
        use(hit.pos);
      } else {
        const position = vec3.sub(player.lookat, state.player.placeoffset);

        try {
          let slot = player.hotbar[0][player.selectedSlot];
          const block = BlockRegistry.getByName(slot?.[1] || "empty slot").ID;

          if (slot) {
            slot[0] -= 1;
            if (slot[0] <= 0) player.hotbar[0][player.selectedSlot] = null;
            useStore.setState({ hotbar: state.player.hotbar });
          }

          const orientation = NORMAL_TO_ORIENTATION(
            state.player.placeoffset,
            state.player.lookatuv,
          );
          state.world.addBlock(
            position,
            Registry.get(state.registrymanager.blockstates, "hash", BlockState.encode(block, { orientation })).ID,
          );
          // TODO don't place if placing into entities
        } catch (_) {
          // No block selected, placing doesn't work
        }
      }
    }
  }

  // damage block if lookat and left click
  const left = state.input.mouse.buttons[MOUSE.LEFT];
  if (!state.player.creative && left && player.lookat) {
    const look = player.lookat;
    state.world.damageBlock(look[0], look[1], look[2], dt, player);
  }

  prof.measure("physics", () =>
    state.physics.tick(
      state.input,
      state.player,
      dt,
      state.world,
      state.registrymanager.blockstates,
    ),
  );

  PlayerSystem.updateLookat(state.player, state.world);

  state.gpuIndirectionBufferOrigin = vec3.floor(
    vec3.divScalar(player.position, CHUNK_SIZE),
  );

  state.input.flush({ button_presses: true });
}

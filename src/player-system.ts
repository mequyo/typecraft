import { vec3 } from "wgpu-matrix";
import { Player } from "./player";
import { World } from "./world";
import { dda, vec3ToLocalChunk } from "./lib";
import { CHUNK_SIZE, ITEM_STACK_SIZE, PLAYER_REACH } from "./constants";
import { AIR } from "./registries/blocks";
import { BlockStateRegistry } from "./registries/blockstate-registry";
import { BlockRegistry } from "./registries/block-registry";

export class PlayerSystem {
  static updateLookat(player: Player, world: World) {
    // TODO some blocks arent full blocks so one should take the uvs into considerations
    player.lookat = null;
    const positions = dda(player.eye, player.direction, PLAYER_REACH); // TODO move dda to a RaycastSystem

    for (const hit of positions) {
      const { pos, face } = hit;
      const offset = vec3.floor(vec3.divScalar(pos, CHUNK_SIZE)); // chunk location
      const chunk = world.getChunk(offset);

      if (!chunk) continue;

      const local = vec3ToLocalChunk(pos); // TODO replace with addScalar
      const blockstate = chunk.get(local[0], local[1], local[2]);

      if (BlockStateRegistry.decode(blockstate).blockID == AIR.ID) continue;

      player.lookat = pos;
      player.placeoffset = face;
      break;
    }
  }

  static addToInventory(player: Player, blockID: number, amount: number): void {
    if (amount <= 0) return;

    const inv = player.inventory;
    const hotbar = player.hotbar;
    const blockname = BlockRegistry.get(blockID).name;

    // Look for itemstacks with same item
    // Hotbar
    for (let col = 0; col < hotbar.length; col++) {
      let slot = hotbar[col]; // ItemStack = [amount, item]

      if (!slot || slot[1] != blockname) continue;

      const space = ITEM_STACK_SIZE - slot[0];
      const add = Math.min(space, amount);

      slot[0] += add;
      amount -= add;

      if (amount <= 0) return;
    }

    // Inventory
    for (let row = 0; row < inv.length; row++) {
      for (let col = 0; col < inv[row].length; col++) {
        let slot = inv[row][col]; // ItemStack = [amount, item]

        if (!slot || slot[1] != blockname) continue;

        const space = ITEM_STACK_SIZE - slot[0];
        const add = Math.min(space, amount);

        slot[0] += add;
        amount -= add;

        if (amount <= 0) return;
      }
    }

    // All itemstacks with same name have been tried, look for empty slots
    for (let col = 0; col < hotbar.length; col++) {
      let slot = hotbar[col]; // ItemStack = [amount, item]

      if (slot) continue;

      hotbar[col] = [Math.min(ITEM_STACK_SIZE, amount), blockname];
      amount -= ITEM_STACK_SIZE;

      if (amount <= 0) return;
    }

    for (let row = 0; row < inv.length; row++) {
      for (let col = 0; col < inv[row].length; col++) {
        let slot = inv[row][col]; // ItemStack = [amount, item]

        if (slot) continue;

        inv[row][col] = [Math.min(ITEM_STACK_SIZE, amount), blockname];
        amount -= ITEM_STACK_SIZE;

        if (amount <= 0) return;
      }
    }
  }

  static printInventory(player: Player) {
    let hotbar = player.hotbar.map((itemstack) => {
      return itemstack == null
        ? "[        ]"
        : `[${itemstack[0].toString().padStart(2, " ")} ${itemstack[1]?.slice(0, 5)}]`;
    });

    let inventory = player.inventory
      .map((row) =>
        row.map((itemstack) => {
          return itemstack == null
            ? "[    ]"
            : `[${itemstack[0].toString().padStart(2, " ")} ${itemstack[1]?.slice(0, 1)}]`;
        }),
      )
      .join("\n");
    console.log(hotbar, inventory);
  }
}

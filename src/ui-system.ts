import { MINIMAP_MAX_ZOOM, MINIMAP_MIN_ZOOM } from "./constants.ts";
import { InputSystem } from "./input-system.ts";
import { PlayerSystem } from "./player-system.ts";
import { Player } from "./player.ts";
import { State } from "./state.ts";
import { Inventory, ItemStack, Menu } from "./types.ts";

export class UISystem {
  private menu: Menu | null = "pause";

  public constructor(player: Player, input: InputSystem) {
    window.addEventListener("resume", (_) => {
      this.setMenu("set", null, input);
    });

    window.addEventListener("hand-pickup", (e) => {
      const data = e.detail;

      if (data.menu == "inventory") {
        const [row, col] = data.slot;
        const itemstack = player.inventory[row][col];

        if (!itemstack) return;

        if (data.mode == "all") {
          player.hand = [...itemstack]; // Put whole stack into hand
          player.inventory[row][col] = null;
        } else {
          player.hand = [Math.ceil(itemstack[0] / 2), itemstack[1]];
          const remain = Math.floor(itemstack[0] / 2);
          player.inventory[row][col] =
            remain == 0 ? null : [remain, itemstack[1]];
        }

        window.dispatchEvent(
          new CustomEvent("ui-update", {
            detail: { inventory: player.inventory, hand: player.hand },
          }),
        );
      }
    });

    window.addEventListener("hand-drop", (e) => {
      const data = e.detail;

      if (data.menu == "inventory" && player.hand) {
        const [row, col] = data.slot;
        const itemstack = player.inventory[row][col];

        // TODO only stack up to STACK_SIZE
        if (!itemstack) {
          if (data.mode == "all") {
            player.inventory[row][col] = [...player.hand]; // Drop all into empty slot
            player.hand = null;
          } else if (data.mode == "one") {
            player.inventory[row][col] = [1, player.hand[1]]; // Drop one into empty slot
            player.hand[0] -= 1;
          }
        } else if (itemstack[1] == player.hand[1]) {
          if (data.mode == "all") {
            player.inventory[row][col] = [
              itemstack[0] + player.hand[0],
              player.hand[1],
            ]; // Stack items
            player.hand = null;
          } else if (data.mode == "one") {
            player.inventory[row][col] = [itemstack[0] + 1, player.hand[1]]; // Drop one from hand into inventory
            player.hand[0] -= 1;
          }
        } else if (data.mode == "all") {
          player.inventory[row][col] = [...player.hand]; // Swap inventory item and hand item
          player.hand = [...itemstack];
        }

        if (player.hand && player.hand[0] <= 0) player.hand = null;

        window.dispatchEvent(
          new CustomEvent("ui-update", {
            detail: { inventory: player.inventory, hand: player.hand },
          }),
        );
      }
    });
  }

  // Handles input and, depending on context, opens a menu or not
  // TODO move input logic to another system
  public tick(input: InputSystem, state: State) {
    if (this.menu == null && input.mouse.wheel != 0) {
      const len = state.player.hotbar.length;
      const sel = state.player.selectedSlot;
      const dir = Math.sign(input.mouse.wheel);
      state.player.selectedSlot = (sel + dir + len) % len;
      window.dispatchEvent(
        new CustomEvent<WindowEventMap["ui-update"]["detail"]>("ui-update", {
          detail: {
            selected: state.player.selectedSlot,
          },
        }),
      );
    }

    if (input.keypresses["c"]) state.player.creative = !state.player.creative;

    if (input.keypresses["+"] && state.minimap.zoom < MINIMAP_MAX_ZOOM) {
      state.minimap.zoom *= 2;
    }

    if (input.keypresses["-"] && state.minimap.zoom > MINIMAP_MIN_ZOOM) {
      state.minimap.zoom /= 2;
    }

    if (input.keypresses["esc"]) {
      this.setMenu("set", "pause", input);
    } else if (input.keypresses["p"]) {
      this.setMenu("toggle", "pause", input);
    } else if (input.keypresses["e"]) {
      this.setMenu("toggle", "inventory", input, {
        inventory: state.player.inventory,
        hand: state.player.hand,
      });
    }
  }

  private setMenu(
    mode: "set" | "toggle",
    menu: Menu | null,
    input: InputSystem,
    updateInventory?: { inventory: Inventory; hand: ItemStack | null },
  ) {
    this.menu = mode == "set" ? menu : this.menu == menu ? null : menu;
    this.menu == null ? input.requestPointerLock() : input.exitPointerLock();

    window.dispatchEvent(
      new CustomEvent<WindowEventMap["ui-update"]["detail"]>("ui-update", {
        detail: {
          menu: this.menu,
          inventory: updateInventory?.inventory,
          hand: updateInventory?.hand,
        },
      }),
    );
  }
}

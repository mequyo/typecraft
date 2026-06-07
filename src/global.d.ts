import { PlayerInventory, InventoryRow, ItemStack, Menu, Stats, UIClick } from "./types";

export { };

declare global {
  interface WindowEventMap {
    "resume": CustomEvent<>
    "stats": CustomEvent<Stats>
    "ui-update": CustomEvent<{ menu?: Menu | null, hand?: ItemStack | null, inventory?: PlayerInventory, selected?: number, hotbar?: InventoryRow }>

    "hand-pickup": CustomEvent<{ menu: Menu, slot: [number, number], mode: "all" | "half" }>
    "hand-drop": CustomEvent<{ menu: Menu, slot: [number, number], mode: "all" | "one" }>

    "uiclick": CustomEvent<UIClick>
  }
}

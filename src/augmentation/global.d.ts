import { Inventory, InventoryRow, ItemStack, Menu, Stats } from "../types";

export { };

declare global {
  interface WindowEventMap {
    "resume": CustomEvent<>
    "stats": CustomEvent<Stats>
    "ui-update": CustomEvent<{ menu?: Menu | null, hand?: ItemStack | null, inventory?: Inventory, selected?: number, hotbar?: InventoryRow }>

    "hand-pickup": CustomEvent<{ menu: Menu, slot: [number, number], mode: "all" | "half" }>
    "hand-drop": CustomEvent<{ menu: Menu, slot: [number, number], mode: "all" | "one" }>
  }
}

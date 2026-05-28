import { Inventory, ItemStack, Menu, Stats } from "../types";

export { };

declare global {
  interface HTMLImageElement {
    average(): [number, number, number, number]
    load(url: string): Promise<HTMLImageElement>
  }

  interface WindowEventMap {
    "resume": CustomEvent<>
    "stats": CustomEvent<Stats>
    "ui-update": CustomEvent<{ menu?: Menu | null, hand?: ItemStack | null, inventory?: Inventory }>

    "hand-pickup": CustomEvent<{ menu: Menu, slot: [number, number], mode: "all" | "half" }>
    "hand-drop": CustomEvent<{ menu: Menu, slot: [number, number], mode: "all" | "one" }>
  }
}

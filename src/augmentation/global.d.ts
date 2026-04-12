import { Inventory, ItemStack, Menu } from "../types";

export { };

declare global {
  interface Array<T> {
    random(): T | undefined
    sum(this: number[]): number
    avg(this: number[]): number
    median(this: number[]): number
  }

  interface Math {
    clamp(min: number, value: number, max: number): number
  }

  interface Number {
    time(type: "ss" | "mm" | "hh" | "mm:ss" | "hh:mm" | "hh:mm:ss"): string
    memory(unit?: "B" | "KB" | "MB" | "GB"): string
    percent(digits: number): string
  }

  interface HTMLImageElement {
    average(): [number, number, number, number]
    load(url: string): Promise<HTMLImageElement>
  }

  interface WindowEventMap {
    "ui-update": CustomEvent<{ menu?: Menu | null, hand?: ItemStack | null, inventory?: Inventory }>

    "hand-pickup": CustomEvent<{ menu: Menu, slot: [number, number], mode: "all" | "half" }>
    "hand-drop": CustomEvent<{ menu: Menu, slot: [number, number], mode: "all" | "one" }>
  }
}
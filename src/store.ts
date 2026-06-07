import { create } from "zustand";
import { GameStore } from "./types";

export const useStore = create<GameStore>(() => ({
  menu: "pause",
  inventory: null,
  hand: null,
  hotbar: null,
  hotbarSelection: 0,
}));

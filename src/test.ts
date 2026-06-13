import { ItemName } from "./types";

// at most 128 => 7 bits
enum KEY {
  KeyQ,
  KeyW,
  KeyE,
  KeyR, // ...
}

// 2 bits
enum MODIFIER {
  CTRL = "ctrl",
  ALT = "alt",
  SHIFT = "shift",
  META = "meta",
}

enum ACTION {
  DROP_ONE,
  DROP_STACK,
  JUMP,
  OPEN_INVENTORY,
  SCROLL_HOTBAR,
  WALK_FORWARD, // ...
}

// at most 64 => 6 bits
enum CONTEXT {
  GAMEPLAY,
  INVENTORY,
  PAUSED, // ...
}

// GAMEPLAY + CTRL + KeyE -> ACTION
type ActionDescription = {
  key: string;
  type: "press" | "continuous";
  description: string;
};
const controls: Record<CONTEXT, Partial<Record<ACTION, ActionDescription>>> = {
  [CONTEXT.GAMEPLAY]: {
    [ACTION.JUMP]: "space",
    [ACTION.SCROLL_HOTBAR]: "u",
    [ACTION.WALK_FORWARD]: "z",
    [ACTION.OPEN_INVENTORY]: "o",
  },
  [CONTEXT.INVENTORY]: {},
  [CONTEXT.PAUSED]: {},
};

/*
REQUIREMENTS & CHALLENGES:
- Detection of double keybinds, context dependent so if two actions have the same key but in different contexts it's fine
- Keyboard independent, use navigator.keyboard.getKeyboardLayoutMap to show actual key later in settings and UI keybind hints
- Differentiate between continuous controls (walking) and pressing (open inventory)
- Fast checks for what action needs to be queued
- Two layers: key (string or number) -> action (number) and action -> function in code for serializability
- Combo (two keys at the same time) and modifier support
- One human-readable controls object that then gets optimized at runtime once
*/

type Recipe =
  | {
      type: "crafting";
      shape: "shaped";
      alias: Record<string, string>;
      input: string[][];
      result: ItemName;
    }
  | {
      type: "crafting";
      shape: "shapeless";
      input: ItemName[];
      result: ItemName;
    }
  | {
      type: "smelting";
      input: ItemName;
      result: ItemName;
    };

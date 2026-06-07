import { MOUSE } from "../input-system";
import { Menu, UIClick } from "../types";

export const onClick = (button: MOUSE, menu: Menu, slot: [number, number]) => {
  window.dispatchEvent(
    new CustomEvent<UIClick>("uiclick", { detail: { menu, slot, button } }),
  );
};

export const onContextMenu = onClick;

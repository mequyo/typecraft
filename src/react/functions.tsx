import { MOUSE } from "../input-system";
import { SubMenu, UIClick } from "../types";

export const onClick = (
  button: MOUSE,
  menu: SubMenu,
  slot: [number, number],
) => {
  window.dispatchEvent(
    new CustomEvent<UIClick>("uiclick", { detail: { menu, slot, button } }),
  );
};

export const onContextMenu = onClick;

import React from "react";
import ReactDOM from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { Inventory, ItemStack, Menu } from "../types";
import { MOUSE } from "../input-system";
import { PauseMenu } from "./pause-menu";
import { InventoryMenu } from "./inventory-menu";
import { Crosshair } from "./crosshair";
import { Hand } from "./hand";
import { Minimap } from "./minimap";
import { StatsUI } from "./stats-ui";

export function Root() {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [hand, setHand] = useState<ItemStack | null>(null);
  const [menu, setMenu] = useState<Menu | null>("pause");
  const handref = useRef<HTMLDivElement>(null);

  const click = (
    button: MOUSE.LEFT | MOUSE.RIGHT,
    menu: Menu,
    row: number,
    col: number,
  ) => {
    if (!hand) {
      window.dispatchEvent(
        new CustomEvent<WindowEventMap["hand-pickup"]["detail"]>(
          "hand-pickup",
          {
            detail: {
              menu,
              slot: [row, col],
              mode: button == MOUSE.LEFT ? "all" : "half",
            },
          },
        ),
      );
    } else {
      window.dispatchEvent(
        new CustomEvent<WindowEventMap["hand-drop"]["detail"]>("hand-drop", {
          detail: {
            menu,
            slot: [row, col],
            mode: button == MOUSE.LEFT ? "all" : "one",
          },
        }),
      );
    }
  };

  useEffect(() => {
    const update = (
      e: CustomEvent<{
        menu?: Menu | null;
        hand?: ItemStack | null;
        inventory?: Inventory;
      }>,
    ) => {
      const m = e.detail.menu,
        h = e.detail.hand,
        i = e.detail.inventory;
      if (m !== undefined) setMenu(m);
      if (h !== undefined) setHand(h == null ? null : [...h]);
      if (i !== undefined) setInventory(i == null ? null : [...i]);
    };

    const mousemove = (e: MouseEvent) =>
      handref.current
        ? (handref.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`)
        : null;

    window.addEventListener("ui-update", update);
    window.addEventListener("mousemove", mousemove);
    window.addEventListener("click", mousemove);
    window.addEventListener("contextmenu", mousemove);

    return () => {
      window.removeEventListener("ui-update", update);
      window.removeEventListener("mousemove", mousemove);
      window.removeEventListener("click", mousemove);
      window.removeEventListener("contextmenu", mousemove);
    };
  }, []);

  return (
    <div className="w-screen h-screen absolute top-0 left-0">
      <Minimap />
      <StatsUI />
      <div
        className={`w-screen h-screen absolute top-0 left-0 justify-center items-center flex flex-col pointer-events-none [image-rendering:pixelated] ${menu && "backdrop-blur-md"}`}
      >
        {menu == null && <Crosshair width={2} height={16} />}
        {menu == "pause" && <PauseMenu />}
        {inventory && menu == "inventory" && (
          <InventoryMenu inventory={inventory} click={click} />
        )}
        {hand && <Hand handref={handref} amount={hand[0]} item={hand[1]} />}
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { PauseMenu } from "./pause-menu";
import { InventoryMenu } from "./inventory-menu";
import { Crosshair } from "./crosshair";
import { Hand } from "./hand";
import { Minimap } from "./minimap";
import { StatsUI } from "./stats-ui";
import { Hotbar } from "./hotbar";
import React from "react";
import ReactDOM from "react-dom/client";
import TestComponent from "./test-component";
import { useStore } from "../store";

const root = document.createElement("div");
document.body.appendChild(root);
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>,
);

export function Main() {
  const inventory = useStore((s) => s.inventory);
  const hand = useStore((s) => s.hand);
  const menu = useStore((s) => s.menu);
  const hotbar = useStore((s) => s.hotbar);
  const selected = useStore((s) => s.hotbarSelection);
  const handref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mousemove = (e: MouseEvent) => {
      if (!handref.current) return;
      handref.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    };

    window.addEventListener("mousemove", mousemove);
    window.addEventListener("click", mousemove);
    window.addEventListener("contextmenu", mousemove);

    return () => {
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
        {inventory && (menu == null || menu == "inventory") && (
          <Hotbar selected={selected} inventory={hotbar} />
        )}
        {inventory && menu == "inventory" && (
          <InventoryMenu inventory={inventory} />
        )}
        {hand && <Hand handref={handref} amount={hand[0]} item={hand[1]} />}
        {/*<TestComponent inventory={inventory} hotbar={hotbar} />*/}
      </div>
    </div>
  );
}

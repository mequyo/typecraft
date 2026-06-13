import { useEffect, useRef } from "react";
import { PauseMenu } from "./pause-menu";
import { Crosshair } from "./crosshair";
import { Hand } from "./hand";
import { Minimap } from "./minimap";
import { StatsUI } from "./stats-ui";
import { Hotbar } from "./hotbar";
import React from "react";
import ReactDOM from "react-dom/client";
import { useStore } from "../store";
import { Inventory } from "./inventory";
import { CraftingTable } from "./crafting-table";
import { Overlay } from "./overlay";

const root = document.createElement("div");
document.body.appendChild(root);
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>,
);

// TODO pressing number on slot swaps slots
// TODO sort inventory

export function Main() {
  const hand = useStore((s) => s.hand);
  const menu = useStore((s) => s.menu);
  const handref = useRef<HTMLDivElement>(null);
  const scale = 4;

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
        {menu == null && <Overlay scale={scale} />}
        {menu == "pause" && <PauseMenu />}
        {
          //inventory && (menu == null || menu == "inventory") && (
          //<Hotbar selected={selected} inventory={hotbar} />
        }
        {menu == "crafting table" && <CraftingTable scale={scale} />}
        {menu == "inventory" && <Inventory scale={scale} />}
        {hand && <Hand handref={handref} itemstack={hand} scale={scale} />}
        {/*<TestComponent />*/}
      </div>
    </div>
  );
}

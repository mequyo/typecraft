import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";
import { Inventory, ItemStack, Menu } from "../types";
import { MOUSE } from "../input-system";




export default function App() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [hand, setHand] = useState<ItemStack | null>(null);
  const handref = useRef<HTMLDivElement>(null);

  const onClick = (button: MOUSE.LEFT | MOUSE.RIGHT, menu: Menu, row: number, col: number) => {
    console.log(button)
    if (!hand) {
      window.dispatchEvent(new CustomEvent<WindowEventMap["hand-pickup"]["detail"]>("hand-pickup", { detail: { menu, slot: [row, col], mode: button == MOUSE.LEFT ? "all" : "half" } }));
    } else {
      window.dispatchEvent(new CustomEvent<WindowEventMap["hand-drop"]["detail"]>("hand-drop", { detail: { menu, slot: [row, col], mode: button == MOUSE.LEFT ? "all" : "one" } }));
    }
  };


  useEffect(() => {
    const update = (e: CustomEvent<{ menu?: Menu | null, hand?: ItemStack | null, inventory?: Inventory }>) => {
      const m = e.detail.menu, h = e.detail.hand, i = e.detail.inventory;
      if (m !== undefined) setMenu(prev => prev == m ? null : m);
      if (h !== undefined) setHand(h == null ? null : [...h]);
      if (i !== undefined) setInventory(i == null ? null : [...i]);
    };

    const mousemove = (e: MouseEvent) => handref.current ? handref.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)` : null;

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
    <div className={`w-screen h-screen absolute top-0 left-0 justify-center items-center flex flex-col pointer-events-none [image-rendering:pixelated] ${menu && "backdrop-blur-md"}`} >

      {inventory && menu == "inventory" && <InventoryUI className="pointer-events-auto" inventory={inventory} onClick={onClick} />}

      {hand && (
        <div ref={handref} className="fixed top-0 left-0 w-16 h-16 -translate-1/2">
          <ItemStackUI amount={hand[0]} item={hand[1]} />
        </div>
      )}
    </div>
  );
}




function InventoryUI({ className, style, inventory, onClick }: { className?: string, style?: CSSProperties, inventory: Inventory, onClick: (e: MOUSE.LEFT | MOUSE.RIGHT, menu: Menu, row: number, col: number) => void }) {

  return (
    <div className={`relative flex flex-col justify-center items-center w-screen ${className}`} style={style}>
      <NineSlice borderImage="url(./ui/inventory_slice.png)" className="relative flex justify-center pt-6 pb-2" padding={16}>
        <div className="grid grid-cols-9 grid-rows-4 gap-2 justify-center items-center">
          {inventory.map((row, ri) => (
            row.map((itemstack, ci) => (
              <div
                draggable={false}
                style={{ gridColumnStart: ci + 1, gridRowStart: ri + 1, backgroundImage: "url(./ui/item-slot.png)", backgroundSize: "100% 100%" }}
                className="w-16 h-16 flex justify-center items-center relative"
                key={`item-slot-${ri}-${ci}`}
                data-slot={JSON.stringify([ri, ci])}
              >
                <ItemStackUI
                  onClick={_ => onClick(MOUSE.LEFT, "inventory", ri, ci)}
                  onContextMenu={_ => onClick(MOUSE.RIGHT, "inventory", ri, ci)}
                  amount={itemstack?.[0]}
                  item={itemstack?.[1]}
                />
              </div>
            ))
          ))}
        </div>
      </NineSlice>

      <img src="./ui/inventory_banner.png" className="-translate-y-1/2 w-fit h-fit scale-400 top-0 absolute" />
    </div>
  );
}




function ItemStackUI({ amount, item, ...props }: { amount?: number, item?: string } & React.ComponentProps<"div">) {
  return (
    <div {...props} draggable={false} className={"relative flex justify-center items-center w-full h-full hover:bg-gray-300/40 cursor-pointer"}>
      {item != null && <img draggable={false} className="w-3/4 h-3/4" style={{ filter: "drop-shadow(3px 3px 0px gray)" }} src={`./items/${item}.png`} />}
      {amount != null && <div draggable={false} className="absolute bottom-0 text-white" style={{ textShadow: "3px 3px 0px gray" }}>{amount}</div>}
    </div>
  );
}




type NineSliceParams = { children?: ReactNode, className?: string, style?: CSSProperties, borderImage: string, slice?: number, padding: number }

function NineSlice({ children, className, style, borderImage, slice = 20, padding }: NineSliceParams) {
  const scale = 4;

  return (
    <div
      className={className}
      style={{
        ...style,
        borderImage,
        borderImageSlice: `${slice} fill`,
        borderImageWidth: `${slice * scale}px`,
        borderImageRepeat: "repeat",
        borderWidth: padding,
        imageRendering: "pixelated"
      }}
    >
      {children}
    </div>
  );
}
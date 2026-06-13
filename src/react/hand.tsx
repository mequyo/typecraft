import { ItemStack } from "../types";
import { ContainerSlot } from "./container-slot";

export function Hand({
  handref,
  itemstack,
  scale,
}: {
  handref: React.RefObject<HTMLDivElement | null>;
  itemstack: ItemStack;
  scale: number;
}) {
  return (
    <div
      ref={handref}
      className="fixed top-0 left-0 w-16 h-16 -translate-1/2 pointer-events-none"
    >
      <ContainerSlot
        col={0}
        row={0}
        scale={scale}
        itemstack={itemstack}
        submenu="player hand"
        className="pointer-events-none"
        theme="inventory"
        amountBackgroundTransparent={true}
      />
    </div>
  );
}

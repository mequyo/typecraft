import { ItemStack } from "../types";
import { ContainerSlot } from "./container-slot";

export function Hand({
  handref,
  itemstack,
}: {
  handref: React.RefObject<HTMLDivElement | null>;
  itemstack: ItemStack;
}) {
  return (
    <div ref={handref} className="fixed top-0 left-0 w-16 h-16 -translate-1/2">
      <ContainerSlot
        col={0}
        row={0}
        scale={1}
        itemstack={itemstack}
        submenu=""
      />
    </div>
  );
}

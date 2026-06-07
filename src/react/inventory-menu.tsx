import { MOUSE } from "../input-system";
import { PlayerInventory } from "../types";
import { onClick, onContextMenu } from "./functions";
import { ItemStackUI } from "./itemstack-ui";
import { NineSlice } from "./nine-slice";

type Parameters = {
  inventory: PlayerInventory;
};

export function InventoryMenu({
  inventory,
  ...props
}: Parameters & React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={`relative flex flex-col justify-center items-center w-screen pointer-events-auto`}
    >
      <NineSlice
        borderImage="url(./ui/inventory_slice.png)"
        className="relative flex justify-center pt-6 pb-2"
        padding={16}
      >
        <div
          className="grid gap-2 justify-center items-center"
          style={{ gridColumn: inventory[0].length, gridRow: inventory.length }}
        >
          {inventory.map((row, ri) =>
            row.map((itemstack, ci) => (
              <div
                draggable={false}
                style={{
                  gridColumnStart: ci + 1,
                  gridRowStart: ri + 1,
                  backgroundImage: "url(./ui/item-slot.png)",
                  backgroundSize: "100% 100%",
                }}
                className="w-16 h-16 flex justify-center items-center relative"
                key={`item-slot-${ri}-${ci}`}
                data-slot={JSON.stringify([ri, ci])}
              >
                <ItemStackUI
                  onClick={(_) => onClick(MOUSE.LEFT, "inventory", [ri, ci])}
                  onContextMenu={(_) =>
                    onContextMenu(MOUSE.RIGHT, "inventory", [ri, ci])
                  }
                  amount={itemstack?.[0]}
                  item={itemstack?.[1]}
                />
              </div>
            )),
          )}
        </div>
      </NineSlice>

      <img
        src="./ui/inventory_banner.png"
        className="-translate-y-1/2 w-fit h-fit scale-400 top-0 absolute"
      />
    </div>
  );
}

import { InventoryRow } from "../types";
import { ItemStackUI } from "./itemstack-ui";
import { NineSlice } from "./nine-slice";

type Parameters = {
  inventory: InventoryRow | null;
  selected: number;
};

export function Hotbar({
  inventory,
  selected,
  ...props
}: Parameters & React.ComponentProps<"div">) {
  if (!inventory) return <div></div>;

  return (
    <div
      className={`absolute bottom-3 flex flex-col justify-center items-center w-screen pointer-events-auto`}
    >
      <NineSlice
        borderImage="url(./ui/inventory_slice.png)"
        className="relative flex justify-center p-2"
        padding={16}
      >
        <div
          className="grid grid-rows-1 gap-2 justify-center items-center"
          style={{ gridColumn: inventory.length }}
        >
          {inventory.map((itemstack, i) => (
            <div
              draggable={false}
              style={{
                gridColumnStart: i + 1,
                gridRowStart: 1,
                backgroundImage: "url(./ui/item-slot.png)",
                backgroundSize: "100% 100%",
              }}
              className="w-16 h-16 flex justify-center items-center relative"
              key={`hotbar-slot-${i}`}
              //data-slot={JSON.stringify([ri, ci])}
            >
              <ItemStackUI
                //onClick={(_) => click(MOUSE.LEFT, "inventory", ri, ci)}
                //onContextMenu={(_) => click(MOUSE.RIGHT, "inventory", ri, ci)}
                className={`${i == selected && "bg-amber-700/40"}`}
                amount={itemstack?.[0]}
                item={itemstack?.[1]}
              />
            </div>
          ))}
        </div>
      </NineSlice>
    </div>
  );
}

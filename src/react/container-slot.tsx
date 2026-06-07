import { ItemStack, SubMenu } from "../types";
import { onClick, onContextMenu } from "./functions";

type SlotProperties = {
  itemstack: ItemStack | null;
  col: number;
  row: number;
  scale: number;
  submenu: SubMenu;
};
export function ContainerSlot({
  itemstack,
  col,
  row,
  scale,
  submenu,
}: SlotProperties) {
  const imageScale = 12 / 16;

  return (
    <div
      key={`slot-${col}-${row}`}
      className="flex justify-center items-center relative hover:bg-gray-300/40 cursor-pointer pointer-events-auto"
      style={{
        gridColumnStart: col + 1,
        gridRowStart: row + 1,
      }}
      onClick={(e) => onClick(e.button, submenu, [row, col])}
      onContextMenu={(e) => onContextMenu(e.button, submenu, [row, col])}
    >
      {itemstack && (
        <img
          src={`/items/${itemstack[1]}.png`}
          style={{
            width: `${imageScale * 100}%`,
            height: `${imageScale * 100}%`,
            filter: `drop-shadow(${scale * imageScale}px ${scale * imageScale}px ${(scale * imageScale) / 2}px #746B72)`,
          }}
        />
      )}
      {itemstack && (
        <div
          className="absolute right-0 bottom-0 font-extrabold size-6 flex justify-end items-end"
          style={{
            backgroundColor: "#D5DADD",
            fontSize: 2.5 * scale,
            width: "30%",
            height: "30%",
            borderRadius: `${2 * scale}px 0px 0px 0px`,
          }}
        >
          <span style={{ color: "#746B72" }}>{itemstack[0]}</span>
        </div>
      )}
    </div>
  );
}

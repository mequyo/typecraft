import { ColorScheme, ItemStack, SubMenu } from "../types";
import { onClick, onContextMenu } from "./functions";

type SlotTheme = "inventory" | "crafting" | "hotbar";
const THEMES: Record<SlotTheme, ColorScheme> = {
  inventory: {
    light: "#D5DADD",
    base: "#A7AAAF",
    dark: "#746B72",
  },
  crafting: {
    light: "#803F24",
    base: "#63311C",
    dark: "#522513",
  },
  hotbar: {
    light: "#A3A2AB",
    base: "#7E7F86",
    dark: "#50565F",
  },
};

type SlotProperties = {
  itemstack?: ItemStack | null;
  col: number;
  row: number;
  scale: number;
  submenu: SubMenu;
  theme: SlotTheme;
  amountBackgroundTransparent?: boolean;
} & React.ComponentProps<"div">;

// TODO outer pixels should not light up
// TODO don't do pointer cursor when no itemstack
// TODO slot should have a way to change color
// TODO
export function ContainerSlot({
  itemstack,
  col,
  row,
  scale,
  submenu,
  className,
  theme,
  amountBackgroundTransparent,
}: SlotProperties) {
  const imageScale = 12 / 16;

  return (
    <div
      key={`slot-${col}-${row}`}
      className={
        "flex justify-center items-center relative hover:bg-(--slot-color)/40 cursor-pointer pointer-events-auto " +
        className
      }
      style={{
        gridColumnStart: col + 1,
        gridRowStart: row + 1,
        width: 16 * scale,
        height: 16 * scale,
        // @ts-ignore
        "--slot-color": THEMES[theme].light, // Dynamic slot hover color
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
            filter: `drop-shadow(${scale * imageScale}px ${scale * imageScale}px ${(scale * imageScale) / 2}px ${THEMES[theme].dark})`,
          }}
        />
      )}
      {itemstack && (
        <div
          className="absolute right-0 bottom-0 font-extrabold size-6 flex justify-end items-end"
          style={{
            backgroundColor: amountBackgroundTransparent
              ? "transparent"
              : THEMES[theme].light,
            fontSize: 2.5 * scale,
            width: "30%",
            height: "30%",
            borderRadius: `${2 * scale}px 0px 0px 0px`,
          }}
        >
          <span style={{ color: THEMES[theme].dark }}>{itemstack[0]}</span>
        </div>
      )}
    </div>
  );
}

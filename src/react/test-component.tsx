import { ReactNode } from "react";
import { Inventory, InventoryRow, ItemStack } from "../types";

type TestComponentProps = {
  inventory: Inventory | null;
  hotbar: InventoryRow | null;
};
export default function TestComponent({
  inventory,
  hotbar,
}: TestComponentProps) {
  if (!inventory) return;

  const scale = 5;

  return (
    <div className="absolute top-0 left-0 w-screen h-screen flex justify-center items-center z-20">
      <div
        className="flex flex-col"
        style={{
          padding: 8 * scale,
          width: 176 * scale,
          height: 173 * scale,
          backgroundImage: "url(/ui/inventory.png)",
          backgroundSize: "100% 100%",
        }}
      >
        {/* Armor and Crafting */}
        <Grid rows={4} cols={9} scale={scale}>
          <div className="bg-red-600/30  col-start-1 row-start-1"></div>
          <div className="bg-red-600/30  col-start-1 row-start-2"></div>
          <div className="bg-red-600/30 w-full h-full col-start-1 row-start-3"></div>
          <div className="bg-red-600/30 w-full h-full col-start-1 row-start-4"></div>
          <div className="bg-red-600/30 w-full h-full col-start-2 row-start-1 col-span-3 row-span-4"></div>
          <div className="bg-red-600/30 w-full h-full col-start-5 row-start-4"></div>
          <div className="bg-red-600/30  col-start-7 row-start-1"></div>
          <div className="bg-red-600/30  col-start-8 row-start-1"></div>
          <div className="bg-red-600/30  col-start-7 row-start-2"></div>
          <div className="bg-red-600/30  col-start-8 row-start-2"></div>
          <div className="bg-red-600/30  col-start-7 row-start-4"></div>
          <div className="bg-red-600/30  col-start-8 row-start-4"></div>
        </Grid>
        {/* Inventory */}
        <Grid rows={3} cols={9} scale={scale} paddingtop={11}>
          {inventory?.map((row, r) =>
            row.map((itemstack, c) => (
              <Slot itemstack={itemstack} col={c} row={r} scale={scale} />
            )),
          )}
        </Grid>
        {/* Hotbar */}
        <Grid rows={1} cols={9} scale={scale} paddingtop={8}>
          {hotbar?.map((itemstack, c) => (
            <Slot itemstack={itemstack} col={c} row={0} scale={scale} />
          ))}
        </Grid>
      </div>
    </div>
  );
}

type GridProperties = {
  cols: number;
  rows: number;
  scale: number;
  paddingtop?: number;
  children?: ReactNode;
} & React.ComponentProps<"div">;
function Grid({
  cols,
  rows,
  scale,
  children,
  paddingtop,
  ...props
}: GridProperties) {
  return (
    <div
      className={`grid w-fit h-fit ${props.className}`}
      style={{
        paddingTop: (paddingtop || 0) * scale,
        gap: 2 * scale,
        gridColumn: cols,
        gridRow: rows,
        gridTemplateColumns: `repeat(${cols}, ${16 * scale}px)`,
        gridTemplateRows: `repeat(${rows}, ${16 * scale}px)`,
      }}
    >
      {children}
    </div>
  );
}

type SlotProperties = {
  itemstack: ItemStack | null;
  col: number;
  row: number;
  scale: number;
};
function Slot({ itemstack, col, row, scale }: SlotProperties) {
  const imageScale = 12 / 16;

  return (
    <div
      key={`slot-${col}-${row}`}
      className="flex justify-center items-center relative"
      style={{
        gridColumnStart: col + 1,
        gridRowStart: row + 1,
      }}
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

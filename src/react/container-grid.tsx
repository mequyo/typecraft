import { useStore } from "../store";
import { ContainerSlot } from "./container-slot";

type GridProperties = {
  cols: number;
  rows: number;
  scale: number;
  paddingtop?: number;
  paddingleft?: number;
  children?: React.ReactNode;
} & React.ComponentProps<"div">;
export function ContainerGrid({
  cols,
  rows,
  scale,
  children,
  paddingtop,
  paddingleft,
  ...props
}: GridProperties) {
  return (
    <div
      className={`grid w-fit h-fit ${props.className}`}
      style={{
        paddingTop: (paddingtop || 0) * scale,
        paddingLeft: (paddingleft || 0) * scale,
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

export function ContainerGridInventory({
  scale,
  paddingtop,
  paddingleft,
}: {
  scale: number;
  paddingtop: number;
  paddingleft: number;
}) {
  const inventory = useStore((s) => s.inventory);

  return (
    <ContainerGrid
      rows={3}
      cols={9}
      scale={scale}
      paddingtop={paddingtop}
      paddingleft={paddingleft}
    >
      {inventory?.map((row, r) =>
        row.map((itemstack, c) => (
          <ContainerSlot
            itemstack={itemstack}
            col={c}
            row={r}
            scale={scale}
            submenu="player inventory"
            key={`inventory-${r}-${c}`}
          />
        )),
      )}
    </ContainerGrid>
  );
}

export function ContainerGridHotbar({
  scale,
  paddingtop,
  paddingleft,
}: {
  scale: number;
  paddingtop: number;
  paddingleft: number;
}) {
  const hotbar = useStore((s) => s.hotbar);

  return (
    <ContainerGrid
      rows={3}
      cols={9}
      scale={scale}
      paddingtop={paddingtop}
      paddingleft={paddingleft}
    >
      {hotbar?.map((row, r) =>
        row.map((itemstack, c) => (
          <ContainerSlot
            itemstack={itemstack}
            col={c}
            row={r}
            scale={scale}
            submenu="player inventory"
            key={`inventory-${r}-${c}`}
          />
        )),
      )}
    </ContainerGrid>
  );
}

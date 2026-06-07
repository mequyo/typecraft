import { useStore } from "../store";
import {
  ContainerGrid,
  ContainerGridHotbar,
  ContainerGridInventory,
} from "./container-grid";
import { ContainerSlot } from "./container-slot";
import { ScaledImage } from "./scaled-image";

type CraftingTableProps = {
  scale: number;
};
export function CraftingTable({ scale }: CraftingTableProps) {
  return (
    <ScaledImage scale={scale} url="/ui/crafting-table.png">
      {/* CRAFTING TABLE */}
      <ContainerGrid
        scale={scale}
        rows={3}
        cols={6}
        paddingleft={18}
        paddingtop={10}
      >
        {[
          ["", "carrot", ""],
          ["", "", ""],
          ["", "", ""],
        ].map((row, r) =>
          row.map((name, c) => (
            <ContainerSlot
              col={c}
              row={r}
              scale={scale}
              itemstack={name ? [3, name] : null}
              submenu=""
            />
          )),
        )}
        <ContainerSlot col={5} row={1} scale={scale} submenu="" />
      </ContainerGrid>

      <ContainerGridInventory scale={scale} paddingleft={0} paddingtop={16} />
      <ContainerGridHotbar scale={scale} paddingleft={0} paddingtop={8} />
    </ScaledImage>
  );
}

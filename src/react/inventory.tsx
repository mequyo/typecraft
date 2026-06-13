import { useStore } from "../store";
import {
  ContainerGrid,
  ContainerGridHotbar,
  ContainerGridInventory,
} from "./container-grid";
import { ContainerSlot } from "./container-slot";

type InventoryProps = {
  scale: number;
};
export function Inventory({ scale }: InventoryProps) {
  const inventory = useStore((s) => s.inventory);
  const hotbar = useStore((s) => s.hotbar);

  return (
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
      <ContainerGrid rows={4} cols={9} scale={scale}>
        {/*<div className="bg-red-600/30  col-start-1 row-start-1"></div>
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
        <div className="bg-red-600/30  col-start-8 row-start-4"></div>*/}
      </ContainerGrid>
      {/* Inventory */}
      <ContainerGridInventory scale={scale} paddingleft={0} paddingtop={11} />

      {/* Hotbar */}
      <ContainerGridHotbar
        scale={scale}
        paddingleft={0}
        paddingtop={8}
        gap={2}
      />
    </div>
  );
}

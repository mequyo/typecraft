import { useStore } from "../store";
import { ContainerGrid, ContainerGridHotbar } from "./container-grid";
import { ContainerSlot } from "./container-slot";
import { Crosshair } from "./crosshair";
import { ScaledImage } from "./scaled-image";

export function Overlay({ scale }: { scale: number }) {
  return (
    <>
      <Crosshair width={2} height={16} />
      {/* Experience Bar */}
      {/* Hearts and Armor */}
      {/* Hotbar */}
      <Hotbar scale={scale} />
      {/* Crosshair */}
    </>
  );
}

function Hotbar({ scale }: { scale: number }) {
  const selected = useStore((s) => s.hotbarSelection);
  const hotbar = useStore((s) => s.hotbar);

  return (
    <ScaledImage
      scale={scale}
      url="/ui/hotbar.png"
      className="absolute bottom-2"
    >
      <ContainerGrid
        cols={9}
        rows={1}
        scale={scale}
        gap={4}
        paddingleft={3}
        paddingtop={2}
      >
        <ScaledImage
          scale={scale}
          url="/ui/hotbar_selection.png"
          style={{ gridColumnStart: selected + 1 }}
          className="row-start-1 -translate-x-4 -translate-y-3"
        ></ScaledImage>
        {hotbar.map((row, r) =>
          row.map((itemstack, c) => (
            <ContainerSlot
              col={c}
              row={r}
              scale={scale}
              itemstack={itemstack}
            />
          )),
        )}
      </ContainerGrid>
    </ScaledImage>
  );
}

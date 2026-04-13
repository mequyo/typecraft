import { ItemStackUI } from "./itemstack-ui";

export function Hand({ handref, amount, item }: { handref: React.RefObject<HTMLDivElement | null>, amount: number, item: string }) {
  return (
    <div ref={handref} className="fixed top-0 left-0 w-16 h-16 -translate-1/2">
      <ItemStackUI amount={amount} item={item} />
    </div>
  );
}
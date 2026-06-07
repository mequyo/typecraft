import { Inventory } from "./inventory";

export default function TestComponent() {
  const scale = 5;

  return (
    <div className="absolute top-0 left-0 w-screen h-screen flex justify-center items-center z-20">
      <Inventory scale={scale} />
    </div>
  );
}

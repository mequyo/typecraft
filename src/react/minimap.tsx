import { MINIMAP_UI_SIZE } from "../constants";

export function Minimap() {
  return (
    <div
      className="absolute top-2.5 right-2.5 rounded-2xl overflow-hidden backdrop-blur-md flex justify-center items-center"
      style={{ border: "3px solid rgba(255, 255, 255, 0.3)", width: MINIMAP_UI_SIZE, height: MINIMAP_UI_SIZE }}
    >
      <canvas id="minimap" className="backdrop-blur-md"></canvas>
    </div>
  );
}
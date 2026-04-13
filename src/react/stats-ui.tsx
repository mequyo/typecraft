import { useEffect, useState } from "react";
import { Stats } from "../types";

export function StatsUI() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const update = () => {

    };

    window.addEventListener("stats", update);
    return window.removeEventListener("stats", update);
  });

  return (
    <div
      className="absolute top-2.5 left-2.5 gap-1 rounded-lg text-white backdrop-blur-md p-1 flex flex-col"
      style={{ background: "rgba(255, 255, 255, 0.3)", border: "3px solid rgba(255, 255, 255, 0.3)" }}
    >
      <span>time</span>
      <span>cpu</span>
      <span>gpu</span>
      <span>position</span>
      <span>direction</span>
      <span>speed</span>
      <span>lookat</span>
      <span>creative</span>
      <span>vertices</span>
      <span>fov</span>
      <span>loaded/rendered chunks</span>
      <span>memory</span>
      <span>chunk generation time</span>
    </div>
  );
}
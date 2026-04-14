import { useEffect, useState } from "react";
import { Stats } from "../types";

export function StatsUI() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const update = (stats: Stats) => setStats(stats);

    window.addEventListener("stats", e => update(e.detail));
    return window.removeEventListener("stats", _ => update);
  });

  const chunksLoaded = stats?.chunks.loaded || 0;
  const chunksRendered = stats?.chunks.rendered || 0;
  const mem = { used: stats?.chunks.memory.usedBytes || 0, total: stats?.chunks.memory.totalBytes || 0 }

  return (
    <div
      className="absolute top-2.5 left-2.5 gap-1 rounded-lg text-white backdrop-blur-md p-1 flex flex-col"
      style={{ background: "rgba(255, 255, 255, 0.3)", border: "3px solid rgba(255, 255, 255, 0.3)" }}
    >
      <span>TIME: {stats?.time.time("hh:mm:ss") || "00:00:00"}</span>
      <span>CPU: {stats?.cpu.averageFPS.toFixed() || "-"} avg, {stats?.cpu.lows.toFixed() || "-"} low</span>
      <span>GPU: {stats?.gpu.averageFPS.toFixed() || "-"} avg, {stats?.gpu.lows.toFixed() || "-"} lows</span>

      <span>POSITION: {stats?.player.position.map(p => Math.floor(p)).join(" ") || "-"}</span>
      <span>DIRECTION: {stats?.player.direction.map(p => Math.floor(p)).join(" ") || "-"}</span>
      <span>LOOKING AT: {stats?.player.lookat?.map(p => Math.floor(p)).join(" ") || "nothing"}</span>
      <span>SPEED: {stats?.player.speed.reduce((prev, acc) => prev + acc, 0).toFixed(1) || "-"} m/s</span>

      <span>CHUNKS: {chunksLoaded} loaded, {chunksRendered} rendered ({Math.floor(100 * chunksRendered / chunksLoaded)}%)</span>
      <span>MEMORY: {mem.used.memory("MB")} / {mem.total.memory("MB")} ({(100 * mem.used / mem.total).toFixed(1)}%)</span>
      <span>GENERATION TIME: {stats?.chunks.avgGenTime.toFixed(1) || 0} ms</span>
    </div>
  );
}
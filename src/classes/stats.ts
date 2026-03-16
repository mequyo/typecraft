import { vec3 } from "wgpu-matrix"
import { BYTES_PER_VERTEX } from "../constants"
import { State } from "../state"



export class Stats {
  private static all: Stats[] = []
  private element: HTMLElement
  private updater: (state: State) => (string | number)
  private interval: number
  private time: number = 0

  constructor(query: string, updater: (state: State) => (string | number), interval: number = 0) {
    const element = document.querySelector(query);

    if (!element) throw new Error(`No element with query ${query} was found.`);
    if (!(element instanceof HTMLElement)) throw new Error("Queried element was not an HTMLElement.");

    this.element = element;
    this.updater = updater;
    this.interval = interval;
    Stats.all.push(this);
  }

  static update(state: State) {
    for (const stat of Stats.all) {
      if ((stat.time += state.time.dt.cpu) >= stat.interval) {
        stat.element.innerText = stat.updater(state).toString();
        stat.time = 0;
      }
    }
  }
}


// Initialize all stat trackers
new Stats("#time", state => state.time.seconds.time("hh:mm:ss"), 0.5);
new Stats("#cpu", state => `avg: ${(1 / state.performance.cpu.avg()).toFixed(0) || "---"} | lows: ${(1 / state.performance.cpu.sort((a, b) => b - a).slice(0, 5).avg()).toFixed(0) || "---"}`, 1);
new Stats("#gpu", state => `avg: ${(1 / state.performance.gpu.avg()).toFixed(0) || "---"} | lows: ${(1 / state.performance.gpu.sort((a, b) => b - a).slice(0, 5).avg()).toFixed(0) || "---"}`, 1);
new Stats("#position", state => state.player.position.map(val => Math.floor(val)).join(" "));
new Stats("#direction", state => state.player.direction.map(val => Math.floor(val)).join(" "));
new Stats("#speed", state => vec3.length(state.player.velocity).toFixed(1) + " m/s");
new Stats("#creative", state => state.player.creative ? "on" : "off");
new Stats("#vertices", state => {
  let vertices = 0;
  const chunks = state.world.chunks.values;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    for (let face = 0; face < 6; face += 1) {
      vertices += chunk.allocations[face].size;
    }
  }

  vertices /= BYTES_PER_VERTEX;

  return `${vertices.toLocaleString()} (${(vertices / state.world.chunks.size).toFixed(0)} per chunk)`;
}, 1);
new Stats("#fov", state => `${Math.round(state.player.fov * 180 / Math.PI)}° / ${(state.player.fov / Math.PI).toFixed(1)} pi`);
new Stats("#chunks", state => `${state.world.rendered} / ${state.world.chunks.size}`);
new Stats("#lookat", state => state.player.lookat?.toString() ?? "nothing");
new Stats("#memory", state => {
  const used = state.chunkBuffer.stats().usedBytes;
  const total = state.chunkBuffer.stats().capacityBytes;

  return `${used.memory()} / ${total.memory()} (${(used / total).percent(1)})`;
}, 0.5);
new Stats("#chunk-generation", state => `avg: ${state.performance.chunk_generation.avg().toFixed(1)}, max: ${state.performance.chunk_generation.reduce((max, curr) => max = Math.max(max, curr), 0).toFixed(1)}`);
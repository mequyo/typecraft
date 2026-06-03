import { RingBuffer } from "./classes/ring-buffer";
import { PROFILER_ENABLED } from "./constants";

type ProfilerMap<T> = Record<(typeof BUFFERS)[number], T>;

const BUFFERS = [
  "chunk generation",
  "chunk meshing",
  "chunk culling",
  "pipeline draw",
  "pipeline updates",
  "minimap",
  "cpu frame time",
  "gpu frame time",
  "physics",
  "ui",
] as const;
const BUFFER_SIZE = 300;

export class Profiler {
  //private last = 0;
  private buffers: ProfilerMap<RingBuffer> = {} as ProfilerMap<RingBuffer>;
  private calls: ProfilerMap<number> = {} as ProfilerMap<number>;

  public constructor() {
    for (let buffer = 0; buffer < BUFFERS.length; buffer++) {
      this.buffers[BUFFERS[buffer]] = new RingBuffer(BUFFER_SIZE);
      this.calls[BUFFERS[buffer]] = 0;
    }
  }

  public measure<T>(key: (typeof BUFFERS)[number], fn: () => T): T {
    const start = performance.now();
    const result = fn();

    if (!PROFILER_ENABLED) return result; // Return early if profiler is disabled

    const time = performance.now() - start;

    if (!this.buffers[key]) {
      this.buffers[key] = new RingBuffer(1000);
      this.calls[key] = 0;
    }

    this.buffers[key].push(time);
    this.calls[key] += 1;
    return result;
  }

  public add(buffer: (typeof BUFFERS)[number], seconds: number) {
    this.buffers[buffer].push(seconds);
  }

  public performance(buffer: (typeof BUFFERS)[number]) {
    return this.buffers[buffer];
  }
}

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
  "culling",
] as const;
const BUFFER_SIZE = 300;

export class Profiler {
  //private last = 0;
  private times: ProfilerMap<RingBuffer> = {} as ProfilerMap<RingBuffer>;
  private calls: ProfilerMap<number> = {} as ProfilerMap<number>;

  public constructor() {
    for (let buffer = 0; buffer < BUFFERS.length; buffer++) {
      this.times[BUFFERS[buffer]] = new RingBuffer(BUFFER_SIZE);
      this.calls[BUFFERS[buffer]] = 0;
    }
  }

  public measure<T>(key: (typeof BUFFERS)[number], fn: () => T): T {
    const start = performance.now();
    const result = fn();

    if (!PROFILER_ENABLED) return result; // Return early if profiler is disabled

    const time = performance.now() - start;

    if (!this.times[key]) {
      this.times[key] = new RingBuffer(1000);
      this.calls[key] = 0;
    }

    this.times[key].push(time);
    this.calls[key] += 1;
    return result;
  }

  public add(buffer: (typeof BUFFERS)[number], seconds: number) {
    this.times[buffer].push(seconds);
    this.calls[buffer] += 1;
  }

  public performance(buffer: (typeof BUFFERS)[number]) {
    return this.times[buffer];
  }

  public log() {
    if (!PROFILER_ENABLED) return;

    const keys = Object.keys(this.times);
    const buffers = Object.values(this.times);
    const calls = Object.values(this.calls);
    const times = buffers.map((buf) => 1000 * buf.average());
    const relatives = times.map((time, i) => (1000 * time) / calls[i]);
    const longestTime = times.reduce(
      (prev, curr) => Math.max(prev, curr.toFixed(0).length),
      0,
    );
    const longestKey = keys.reduce(
      (prev, curr) => Math.max(prev, curr.length),
      0,
    );
    const longestCall = calls.reduce(
      (prev, curr) => Math.max(prev, curr.toString().length),
      0,
    );
    const longestRelative = relatives.reduce(
      (prev, curr) => Math.max(prev, curr.toFixed(0).length),
      0,
    );
    console.log(
      keys
        .map((key, i) => {
          const name = key.padStart(longestKey, " ");
          const time = times[i].toFixed(0).padStart(longestTime, " ");
          const call = calls[i].toString().padStart(longestCall, " ");
          const relative = ((1000 * times[i]) / calls[i])
            .toFixed(0)
            .padStart(longestRelative, " ");
          return `${name}:  ${time}ns  ${call}  ${relative}μs`;
        })
        .join("\n"),
    );
  }
}

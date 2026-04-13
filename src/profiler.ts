import { RingBuffer } from "./classes/ring-buffer";
import { PROFILER_ENABLED } from "./constants";



export class Profiler {
  private static last = 0;
  private static time: Record<string, RingBuffer> = {};
  private static calls: Record<string, number> = {};


  public static measure<T>(key: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();

    if (!PROFILER_ENABLED) return result; // Return early if profiler is disabled

    const time = performance.now() - start;

    if (!Profiler.time[key]) {
      Profiler.time[key] = new RingBuffer(1000);
      Profiler.calls[key] = 0;
    }

    Profiler.time[key].push(time);
    Profiler.calls[key] += 1;
    return result;
  }



  public static log() {
    if (!PROFILER_ENABLED) return;

    const dt = performance.now() - (this.last || 0);
    const seconds = dt / 1000;
    const entries = Array.from(Object.entries(this.time));

    let total = entries.reduce((prev, curr) => prev + curr[1].sum(), 0);
    let str = "[PROFILER]          per call    /sec\n";

    for (let i = 0; i < entries.length; i++) {
      const category = entries[i][0];
      const buffer = entries[i][1];
      const calls = this.calls[category];
      const sum = buffer.sum();
      const mu_per_call = (1000 * sum / calls).toFixed(0);
      const ms_per_second = (sum / seconds).toFixed();
      const percent = (100 * sum / total).toFixed();

      str += `${(category + ":").padEnd(20, " ")} ${mu_per_call.padStart(5, " ")}µs ${ms_per_second.padStart(5, " ")}ms ${percent.padStart(4, " ")}% \n`;
      this.calls[category] = 0;
    }

    console.log(str);
    this.last = performance.now();
  }
}

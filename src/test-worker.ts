





self.onmessage = () => {
  const sleepBuffer = new SharedArrayBuffer(4);
  const sleepArray = new Int32Array(sleepBuffer);
  const TICK_RATE = 50;

  function sleep(ms: number): void {
    Atomics.wait(sleepArray, 0, 0, ms);
  }

  async function loop() {
    while (true) {
      const start = performance.now();

      tick();

      const elapsed = performance.now() - start;



      sleep(Math.max(0, TICK_RATE - elapsed));
      console.log(performance.now() - start)
    }
  }

  function tick() {

  }

  loop();
}
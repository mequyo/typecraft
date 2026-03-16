// Turns mouse and keyboard events into game events like "jump" or "walk"
// For now, keys are hardcoded so Systems have to look for specific keys like space for jumping

export enum MOUSE {
  LEFT = 0, MIDDLE = 1, RIGHT = 2,
}

type Mouse = {
  buttons: [boolean, boolean, boolean],
  wheel: number,
  dx: number,
  dy: number,
  x: number,
  y: number,
  clicked: [boolean, boolean, boolean],
}

export class InputSystem {
  public keys: Record<string, boolean> = {};
  public keypresses: Record<string, boolean> = {};
  private pointerlock = false;
  private canvas: HTMLCanvasElement;
  public mouse: Mouse = { buttons: [false, false, false], wheel: 0, dx: 0, dy: 0, x: 0, y: 0, clicked: [false, false, false] };

  public constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    window.addEventListener("blur", _ => Object.keys(this.keys).forEach(key => this.keys[key] = false));
    window.addEventListener("keyup", e => this.keys[e.key.toLocaleLowerCase()] = false);
    window.addEventListener("keydown", e => { this.keys[e.key.toLowerCase()] = true; this.keypresses[e.key.toLowerCase()] = true });
    window.addEventListener("mousedown", e => this.mouse.buttons[e.button] = true);
    window.addEventListener("mouseup", e => this.mouse.buttons[e.button] = false);
    window.addEventListener("wheel", e => this.mouse.wheel += e.deltaY);
    window.addEventListener("contextmenu", e => e.preventDefault());
    window.addEventListener("click", _ => this.requestPointerLock());
    window.addEventListener("click", e => this.mouse.clicked[e.button] = true);
    window.addEventListener("mousemove", e => {
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
  }

  public flush() {
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.wheel = 0;
    this.keypresses = {};
    this.mouse.clicked = [false, false, false];
  }

  public requestPointerLock() {
    if (this.pointerlock) return;

    this.canvas.requestPointerLock().catch(() => { });
    this.pointerlock = true;

    setTimeout(() => this.pointerlock = false, 1200);
  }

  public exitPointerLock() {
    if (!this.pointerlock) return;

    document.exitPointerLock();
    this.pointerlock = false;
  }
}
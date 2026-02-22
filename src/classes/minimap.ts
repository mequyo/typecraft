import { vec3 } from "wgpu-matrix";
import { Chunk } from "../chunk";
import { CHUNK_SIZE, MINIMAP_INITIAL_ZOOM, MINIMAP_RENDER_SIZE, MINIMAP_UI_SIZE } from "../constants";
import { Player } from "../player";
import { Triple } from "./triple";

export class Minimap {
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private wrapper: HTMLDivElement
  public zoom: number = MINIMAP_INITIAL_ZOOM
  public arrow: ImageBitmap

  constructor(arrow: ImageBitmap) {
    const canvas = document.querySelector<HTMLCanvasElement>("#minimap");
    if (!canvas) throw new Error("");
    this.canvas = canvas;
    this.canvas.width = MINIMAP_RENDER_SIZE;
    this.canvas.height = MINIMAP_RENDER_SIZE;

    const context = this.canvas.getContext("2d");

    if (!context) throw new Error("");

    this.context = context;
    this.context.imageSmoothingEnabled = false;

    const wrapper = document.querySelector<HTMLDivElement>("#minimap_wrapper");
    if (!wrapper) throw new Error("");
    this.wrapper = wrapper;
    this.wrapper.style.width = MINIMAP_UI_SIZE + "px";
    this.wrapper.style.height = MINIMAP_UI_SIZE + "px";

    this.arrow = arrow;
  }


  async render(chunks: Map<number, Chunk>, player: Player) {
    const center = MINIMAP_RENDER_SIZE / 2;
    this.context.fillStyle = "black";
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height)

    const chunkpos = vec3.divScalar(player.position, CHUNK_SIZE);
    const offset = center / CHUNK_SIZE / this.zoom;

    const minCX = Math.floor(chunkpos[0] - offset - 1);
    const maxCX = Math.ceil(chunkpos[0] + offset + 1);
    const minCZ = Math.floor(chunkpos[2] - offset - 1);
    const maxCZ = Math.ceil(chunkpos[2] + offset + 1);

    const array3D = new Triple<number, Chunk>();

    Array
      .from(chunks.values())
      .filter(c => c.blockamount != 0 && c.offset[0] > minCX && c.offset[0] < maxCX && c.offset[2] > minCZ && c.offset[2] < maxCZ)
      .forEach(c => array3D.set(c.offset[0], c.offset[2], c.offset[1], c));

    for (const [_, chunk] of array3D.entriesOrdered(undefined, (a, b) => a - b, undefined)) {
      this.context.drawImage(
        chunk.canvas,
        Math.floor(this.zoom * (chunk.offset[0] * CHUNK_SIZE - player.position[0]) + center),
        Math.floor(this.zoom * (chunk.offset[2] * CHUNK_SIZE - player.position[2]) + center),
        CHUNK_SIZE * this.zoom,
        CHUNK_SIZE * this.zoom,
      );
    }

    // Draw player arrow
    const size = 2 * this.arrow.width;
    this.context.save();
    this.context.translate(center, center);
    this.context.rotate(Math.atan2(player.direction[0], -player.direction[2]));
    this.context.drawImage(this.arrow, -size / 2, -size / 2, size, size);
    this.context.restore();
  }
}
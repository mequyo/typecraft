import { vec3 } from "wgpu-matrix";
import { Chunk } from "../chunk";
import { CHUNK_SIZE, MINIMAP_INITIAL_ZOOM, MINIMAP_RENDER_SIZE, MINIMAP_UI_SIZE, REGION_SIZE, REGION_WIDTH_IN_CHUNKS } from "../constants";
import { Player } from "../player";
import { Triple } from "./triple";
import { SlotMap } from "./slot-map";
import { World } from "../world";
import { Region } from "../region";

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


  async render(chunks: SlotMap<number, Chunk>, player: Player, regions: SlotMap<number, Region>) {
    const center = MINIMAP_RENDER_SIZE / 2;

    this.context.fillStyle = "black";
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let region of regions.values) {
      this.context.drawImage(
        region.canvas,
        Math.floor(this.zoom * (region.rx * REGION_SIZE - player.position[0]) + center),
        Math.floor(this.zoom * (region.rz * REGION_SIZE - player.position[2]) + center),
        REGION_SIZE * this.zoom,
        REGION_SIZE * this.zoom,
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
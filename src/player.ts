import { vec3, Vec3 } from "wgpu-matrix";
import { Camera, CameraDescriptor } from "./camera";
import { PLAYER_HEIGHT, PLAYER_WIDTH } from "./constants";
import { Inventory, InventoryRow, ItemStack } from "./types";

type PlayerDescriptor = {
  camera: CameraDescriptor
  velocity?: Vec3
  min?: Vec3
  max?: Vec3
  creative?: boolean
  inventory?: Inventory
  hotbar?: InventoryRow
}

export class Player extends Camera {
  public velocity: Vec3
  public min: Vec3
  public max: Vec3
  public grounded: boolean
  public creative: boolean
  public lookat: Vec3 | null
  public placeoffset: Vec3
  public inventory: Inventory
  public hotbar: InventoryRow
  public hand: ItemStack | null

  constructor(descriptor: PlayerDescriptor) {
    super(descriptor.camera);

    this.placeoffset = vec3.create(0, 0, 0);
    this.velocity = descriptor.velocity ?? vec3.create(0, 0, 0);
    this.min = descriptor.min ?? vec3.create(-PLAYER_WIDTH / 2, -PLAYER_HEIGHT / 2, -PLAYER_WIDTH / 2);
    this.max = descriptor.max ?? vec3.create(PLAYER_WIDTH / 2, PLAYER_HEIGHT / 2, PLAYER_WIDTH / 2);
    this.hand = null;
    this.hotbar = descriptor.hotbar ?? [null, null, null, [23, "coal"], null, null, [8, "emerald"], null, null];
    this.inventory = descriptor.inventory ?? [
      [[3, "carrot"], null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, [5, "raw iron"], null],
      [null, null, [16, "potato"], null, [32, "potato"], null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
    ];
    this.grounded = true;
    this.creative = descriptor.creative ?? false;
    this.lookat = null

  }
}
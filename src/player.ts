import { vec3, Vec3 } from "wgpu-matrix";
import { Camera, CameraDescriptor } from "./camera";
import { PLAYER_HEIGHT, PLAYER_WIDTH } from "./constants";
import { Inventory, InventoryRow, ItemStack } from "./types";
import { generateInventoryRow } from "./lib";

type PlayerDescriptor = {
  camera: CameraDescriptor;
  velocity?: Vec3;
  min?: Vec3;
  max?: Vec3;
  creative?: boolean;
  inventory?: Inventory;
  hotbar?: InventoryRow;
};

export class Player extends Camera {
  public velocity: Vec3;
  public min: Vec3;
  public max: Vec3;
  public grounded: boolean;
  public creative: boolean;
  public lookat: Vec3 | null;
  public placeoffset: Vec3;
  public inventory: Inventory;
  public hotbar: InventoryRow;
  public hand: ItemStack | null;
  public selectedSlot: number;

  constructor(descriptor: PlayerDescriptor) {
    super(descriptor.camera);

    this.selectedSlot = 0;
    this.placeoffset = vec3.create(0, 0, 0);
    this.velocity = descriptor.velocity ?? vec3.create(0, 0, 0);
    this.min =
      descriptor.min ??
      vec3.create(-PLAYER_WIDTH / 2, -PLAYER_HEIGHT / 2, -PLAYER_WIDTH / 2);
    this.max =
      descriptor.max ??
      vec3.create(PLAYER_WIDTH / 2, PLAYER_HEIGHT / 2, PLAYER_WIDTH / 2);
    this.hand = null;
    this.hotbar = descriptor.hotbar ?? generateInventoryRow();
    this.inventory = descriptor.inventory ?? [
      generateInventoryRow(),
      generateInventoryRow(),
      generateInventoryRow(),
      generateInventoryRow(),
    ];
    this.grounded = true;
    this.creative = descriptor.creative ?? false;
    this.lookat = null;

    window.dispatchEvent(
      new CustomEvent<WindowEventMap["ui-update"]["detail"]>("ui-update", {
        detail: {
          inventory: this.inventory,
          hotbar: this.hotbar,
        },
      }),
    );
  }
}

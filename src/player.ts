import { vec3, Vec3 } from "wgpu-matrix";
import { Camera, CameraDescriptor } from "./camera";
import { PLAYER_HEIGHT, PLAYER_WIDTH } from "./constants";

type PlayerDescriptor = {
  camera: CameraDescriptor
  velocity?: Vec3
  min?: Vec3
  max?: Vec3
  creative?: boolean
}

export class Player extends Camera {
  public velocity: Vec3
  public min: Vec3
  public max: Vec3
  public grounded: boolean
  public creative: boolean
  public lookat: Vec3 | null
  public placeoffset: Vec3

  constructor(descriptor: PlayerDescriptor) {
    super(descriptor.camera);

    this.placeoffset = vec3.create(0, 0, 0);
    this.velocity = descriptor.velocity ?? vec3.create(0, 0, 0);
    this.min = descriptor.min ?? vec3.create(-PLAYER_WIDTH / 2, -PLAYER_HEIGHT / 2, -PLAYER_WIDTH / 2);
    this.max = descriptor.max ?? vec3.create(PLAYER_WIDTH / 2, PLAYER_HEIGHT / 2, PLAYER_WIDTH / 2);
    this.grounded = true;
    this.creative = descriptor.creative ?? false;
    this.lookat = null
  }
}
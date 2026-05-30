import { mat4, Mat4, vec3, Vec3 } from "wgpu-matrix";
import { CAMERA_HEIGHT, PLAYER_HEIGHT, PLAYER_WIDTH } from "./constants";
import { InputSystem } from "./input-system";
import { clamp } from "./lib";

export type CameraDescriptor = {
  canvas: HTMLCanvasElement;
  aspectratio?: number;
  position?: Vec3;
  direction?: Vec3;
  up?: Vec3;
  near?: number;
  far?: number;
  fov?: number;
  active?: boolean;
  sensitivity?: number;
};

export class Camera {
  public canvas: HTMLCanvasElement;
  public aspectratio: number;
  public position: Vec3;
  public direction: Vec3;
  public up: Vec3;
  public near: number;
  public far: number;
  public fov: number;
  public active: boolean;
  public sensitivity: number;
  public yaw: number;
  public pitch: number;
  public right: Vec3;
  public zoom: boolean;
  public lastPosition: Vec3;

  constructor(descriptor: CameraDescriptor) {
    this.canvas = descriptor.canvas;
    this.aspectratio =
      descriptor.aspectratio ?? window.innerWidth / window.innerHeight;
    this.position = descriptor.position ?? vec3.create(0, 0, 0);
    this.direction = descriptor.direction ?? vec3.create(0, 0, 1);
    this.up = descriptor.up ?? vec3.create(0, 1, 0);
    this.near = descriptor.near ?? 0.1;
    this.far = descriptor.far ?? 1000;
    this.fov = descriptor.fov ?? Math.PI / 2;
    this.active = descriptor.active ?? false;
    this.sensitivity = descriptor.sensitivity ?? 0.002;
    this.lastPosition = vec3.copy(this.position);

    this.yaw = Math.atan2(this.direction[0], this.direction[2]);
    this.pitch = Math.asin(-this.direction[1]);
    this.right = vec3.create(
      Math.sin(this.yaw - Math.PI / 2),
      0,
      Math.cos(this.yaw - Math.PI / 2),
    );
    this.zoom = false;
  }

  tick(input: InputSystem) {
    if (!this.active || document.pointerLockElement != this.canvas) return;

    const limit = Math.PI / 2 - 0.001; // 90°
    this.yaw -= input.mouse.dx * this.sensitivity;
    this.pitch -= input.mouse.dy * this.sensitivity;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    this.direction = vec3.normalize(
      vec3.create(
        Math.cos(this.pitch) * Math.sin(this.yaw),
        Math.sin(this.pitch),
        Math.cos(this.pitch) * Math.cos(this.yaw),
      ),
    );
    this.right = vec3.normalize(vec3.cross(this.direction, this.up));

    this.fov = clamp(
      Math.PI / 180,
      this.fov + (input.mouse.wheel / 100 / 180) * Math.PI,
      2 * Math.PI,
    ); // Clamp between 1° and 360°

    // Zooming like a spyglass
    const z = input.keys["z"] == true;
    if (this.zoom != z) {
      this.zoom = z;
      this.fov *= z ? 0.5 : 2;
    }
  }

  get projection(): Mat4 {
    return mat4.perspective(this.fov, this.aspectratio, this.near, this.far);
  }

  get topdown(): Mat4 {
    const blocks_per_axis = 32;
    const ortho = mat4.ortho(
      -blocks_per_axis,
      blocks_per_axis,
      -blocks_per_axis,
      blocks_per_axis,
      this.near,
      this.far,
    );
    const up = vec3.create(0, 0, -1);
    const lookat = mat4.lookAt(
      vec3.add(this.position, vec3.create(0, 50, 0)),
      this.position,
      up,
    );

    return mat4.mul(ortho, lookat);
  }

  view(alpha?: number): Mat4 {
    const p = this.interpolate(alpha ?? 0);
    const target = vec3.add(p, this.direction);
    return mat4.lookAt(p, target, this.up);
  }

  get aabb(): { min: Vec3; max: Vec3 } {
    return {
      min: vec3.sub(
        this.position,
        vec3.create(PLAYER_WIDTH / 2, CAMERA_HEIGHT, PLAYER_WIDTH / 2),
      ),
      max: vec3.add(
        this.position,
        vec3.create(
          PLAYER_WIDTH / 2,
          PLAYER_HEIGHT - CAMERA_HEIGHT,
          PLAYER_WIDTH / 2,
        ),
      ),
    };
  }

  get eye(): Vec3 {
    return vec3.create(this.position[0], this.position[1], this.position[2]);
  }

  interpolate(alpha: number) {
    return vec3.addScaled(
      this.lastPosition,
      vec3.sub(this.position, this.lastPosition),
      alpha,
    );
  }
}

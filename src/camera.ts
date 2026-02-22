import { mat4, Mat4, vec3, Vec3 } from "wgpu-matrix";
import { CAMERA_HEIGHT, PLAYER_HEIGHT, PLAYER_WIDTH } from "./constants";

export type CameraDescriptor = {
  canvas: HTMLCanvasElement
  aspectratio?: number
  position?: Vec3
  direction?: Vec3
  up?: Vec3
  near?: number
  far?: number
  fov?: number
  active?: boolean
  sensitivity?: number
}

export class Camera {
  public canvas: HTMLCanvasElement
  public aspectratio: number
  public position: Vec3
  public direction: Vec3
  public up: Vec3
  public near: number
  public far: number
  public fov: number
  public active: boolean
  public sensitivity: number
  public yaw: number
  public pitch: number
  public right: Vec3

  constructor(descriptor: CameraDescriptor) {
    this.canvas = descriptor.canvas;
    this.aspectratio = descriptor.aspectratio ?? window.innerWidth / window.innerHeight;
    this.position = descriptor.position ?? vec3.create(0, 0, 0);
    this.direction = descriptor.direction ?? vec3.create(0, 0, 1);
    this.up = descriptor.up ?? vec3.create(0, 1, 0);
    this.near = descriptor.near ?? 0.1;
    this.far = descriptor.far ?? 1000;
    this.fov = descriptor.fov ?? Math.PI / 2;
    this.active = descriptor.active ?? false;
    this.sensitivity = descriptor.sensitivity ?? 0.002;

    this.yaw = Math.atan2(this.direction[0], this.direction[2]);
    this.pitch = Math.asin(-this.direction[1]);
    this.right = vec3.create(Math.sin(this.yaw - Math.PI / 2), 0, Math.cos(this.yaw - Math.PI / 2));

    window.addEventListener("mousemove", e => {
      if (!this.active || document.pointerLockElement != this.canvas) return;

      const limit = Math.PI / 2 - 0.001; // 90°
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
      this.direction = vec3.normalize(vec3.create(Math.cos(this.pitch) * Math.sin(this.yaw), Math.sin(this.pitch), Math.cos(this.pitch) * Math.cos(this.yaw)));
      this.right = vec3.normalize(vec3.cross(this.direction, this.up));
    });
  }

  get projection(): Mat4 {
    return mat4.perspective(this.fov, this.aspectratio, this.near, this.far);
  }

  get topdown(): Mat4 {
    const blocks_per_axis = 32;
    const ortho = mat4.ortho(-blocks_per_axis, blocks_per_axis, -blocks_per_axis, blocks_per_axis, this.near, this.far);
    const up = vec3.create(0, 0, -1);
    const lookat = mat4.lookAt(vec3.add(this.position, vec3.create(0, 50, 0)), this.position, up);

    return mat4.mul(ortho, lookat);
  }

  get view(): Mat4 {
    const target = vec3.add(this.position, this.direction);
    return mat4.lookAt(this.position, target, this.up);
  }

  get aabb(): { min: Vec3, max: Vec3 } {
    return {
      min: vec3.sub(this.position, vec3.create(PLAYER_WIDTH / 2, CAMERA_HEIGHT, PLAYER_WIDTH / 2)),
      max: vec3.add(this.position, vec3.create(PLAYER_WIDTH / 2, PLAYER_HEIGHT - CAMERA_HEIGHT, PLAYER_WIDTH / 2)),
    }
  }

  get eye(): Vec3 {
    return vec3.create(this.position[0], this.position[1], this.position[2]);
  }
}

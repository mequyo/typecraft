// lvh.ts
import { Mat4, Vec3, vec3 } from "wgpu-matrix";
import { CHUNK_SIZE } from "../constants";
import { Chunk } from "../chunk";
import { Sixtuple } from "../types";

// GPU-friendly structures (align to 16 bytes for uniform buffers)
export interface BLASInstance {
  meshID: number; // 4 bytes
  faceMask: number; // 4 bytes (which faces are visible)
  padding0: number; // 4 bytes
  padding1: number; // 4 bytes
  modelMatrix: Mat4; // 64 bytes
}

export interface TLASNode {
  bboxMin: Vec3; // 12 bytes
  padding0: number; // 4 bytes
  bboxMax: Vec3; // 12 bytes
  padding1: number; // 4 bytes
  leftChild: number; // 4 bytes (or BLAS index + flag)
  rightChild: number; // 4 bytes
  blasIndex: number; // 4 bytes (if leaf)
  leafCount: number; // 4 bytes
}

// CPU-side BVH node
class BVHNode {
  bboxMin: Vec3 = vec3.create(Infinity, Infinity, Infinity);
  bboxMax: Vec3 = vec3.create(-Infinity, -Infinity, -Infinity);
  left: BVHNode | null = null;
  right: BVHNode | null = null;
  blasIndex: number = -1;
  leafCount: number = 0;

  updateBBox(chunks: LVHChunkInfo[]) {
    if (this.blasIndex !== -1) {
      const chunk = chunks[this.blasIndex];
      vec3.copy(chunk.bboxMin, this.bboxMin);
      vec3.copy(chunk.bboxMax, this.bboxMax);
      return;
    }

    this.bboxMin = vec3.create(Infinity, Infinity, Infinity);
    this.bboxMax = vec3.create(-Infinity, -Infinity, -Infinity);

    if (this.left) {
      vec3.min(this.bboxMin, this.left.bboxMin, this.bboxMin);
      vec3.max(this.bboxMax, this.left.bboxMax, this.bboxMax);
    }
    if (this.right) {
      vec3.min(this.bboxMin, this.right.bboxMin, this.bboxMin);
      vec3.max(this.bboxMax, this.right.bboxMax, this.bboxMax);
    }
  }

  get surfaceArea(): number {
    const dx = this.bboxMax[0] - this.bboxMin[0];
    const dy = this.bboxMax[1] - this.bboxMin[1];
    const dz = this.bboxMax[2] - this.bboxMin[2];
    return 2 * (dx * dy + dy * dz + dz * dx);
  }
}

// Chunk metadata for BVH
interface LVHChunkInfo {
  chunk: Chunk;
  key: number;
  blasIndex: number;
  bboxMin: Vec3;
  bboxMax: Vec3;
  worldOffset: Vec3;
  faceMask: number;
  timestamp: number;
  allocations: Sixtuple<number>;
  centroid: Vec3; // Cache centroid for sorting
}

export class LVH {
  private device: GPUDevice;
  private chunks: Map<number, LVHChunkInfo> = new Map();
  private blasList: LVHChunkInfo[] = [];
  private blasBuffer: GPUBuffer | null = null;
  private tlasBuffer: GPUBuffer | null = null;
  private tlasNodes: TLASNode[] = [];
  private root: BVHNode | null = null;
  private needsRebuild: boolean = true;
  private frameCounter: number = 0;
  private rebuildInterval: number = 60;
  private maxChunksPerNode: number = 8;
  private nodePool: BVHNode[] = []; // Pooling for node reuse

  // Capacity trackers
  private maxBlasByteCapacity = 0;
  private maxTlasByteCapacity = 0;

  // Reusable buffers for SAH sweep (avoid allocations)
  private rightBoundsMinBuffer: Vec3[] = [];
  private rightBoundsMaxBuffer: Vec3[] = [];

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Add or update a chunk in the LVH
   */
  public updateChunk(
    chunk: Chunk,
    key: number,
    faceMask: number,
    allocations: Sixtuple<number>,
  ): void {
    const existing = this.chunks.get(key);

    if (existing) {
      existing.timestamp = performance.now();
      existing.faceMask = faceMask;
      existing.allocations = allocations;

      const newMin = chunk.AABB.min;
      const newMax = chunk.AABB.max;
      if (
        !vec3.equals(existing.bboxMin, newMin) ||
        !vec3.equals(existing.bboxMax, newMax)
      ) {
        vec3.copy(newMin, existing.bboxMin);
        vec3.copy(newMax, existing.bboxMax);
        // Update cached centroid
        existing.centroid = vec3.create(
          (newMin[0] + newMax[0]) * 0.5,
          (newMin[1] + newMax[1]) * 0.5,
          (newMin[2] + newMax[2]) * 0.5,
        );
        this.needsRebuild = true;
      }
    } else {
      const min = chunk.AABB.min;
      const max = chunk.AABB.max;
      const info: LVHChunkInfo = {
        chunk,
        key,
        blasIndex: this.blasList.length,
        bboxMin: vec3.copy(min),
        bboxMax: vec3.copy(max),
        worldOffset: vec3.copy(chunk.offset),
        faceMask,
        timestamp: performance.now(),
        allocations,
        centroid: vec3.create(
          (min[0] + max[0]) * 0.5,
          (min[1] + max[1]) * 0.5,
          (min[2] + max[2]) * 0.5,
        ),
      };
      this.chunks.set(key, info);
      this.blasList.push(info);
      this.needsRebuild = true;
    }
  }

  /**
   * Remove a chunk from the LVH
   */
  public removeChunk(key: number): boolean {
    const info = this.chunks.get(key);
    if (!info) return false;

    info.timestamp = -1;
    this.needsRebuild = true;
    return true;
  }

  /**
   * Rebuild the TLAS from scratch
   */
  public rebuild(): void {
    if (!this.needsRebuild && this.frameCounter++ < this.rebuildInterval)
      return;

    this.frameCounter = 0;
    this.needsRebuild = false;

    // Filter out removed chunks
    const activeChunks: LVHChunkInfo[] = [];
    for (const info of this.blasList) {
      if (info.timestamp !== -1) {
        info.blasIndex = activeChunks.length;
        activeChunks.push(info);
      } else {
        this.chunks.delete(info.key);
      }
    }
    this.blasList = activeChunks;

    this.tlasNodes = [];

    if (this.blasList.length === 0) {
      this.root = null;
      this.updateGPUBuffers();
      return;
    }

    const startTime = performance.now();

    // Pre-allocate sweep buffers
    this.ensureSweepBufferCapacity(this.blasList.length);

    // Build BVH
    this.root = this.buildBVH(this.blasList, 0, this.blasList.length);
    this.flattenBVH(this.root);
    this.updateGPUBuffers();

    console.log(
      `LVH rebuilt: ${this.blasList.length} chunks, ${this.tlasNodes.length} nodes in ${(performance.now() - startTime).toFixed(2)}ms`,
    );
  }

  /**
   * Ensure sweep buffers are large enough (reuse to avoid allocations)
   */
  private ensureSweepBufferCapacity(count: number): void {
    while (this.rightBoundsMinBuffer.length < count) {
      this.rightBoundsMinBuffer.push(vec3.create());
      this.rightBoundsMaxBuffer.push(vec3.create());
    }
  }

  /**
   * Build BVH using Surface Area Heuristic (SAH) - FIXED VERSION
   */
  private buildBVH(
    chunks: LVHChunkInfo[],
    start: number,
    end: number,
  ): BVHNode {
    const node = this.allocateNode();
    const count = end - start;

    // Compute bounds
    for (let i = start; i < end; i++) {
      const chunk = chunks[i];
      vec3.min(node.bboxMin, chunk.bboxMin, node.bboxMin);
      vec3.max(node.bboxMax, chunk.bboxMax, node.bboxMax);
    }

    if (count <= this.maxChunksPerNode) {
      node.blasIndex = start;
      node.leafCount = count;
      return node;
    }

    // Find best split using SAH
    let bestAxis = -1;
    let bestPos = 0;
    let bestCost = Infinity;
    const parentSA = node.surfaceArea;

    // Try each axis
    for (let axis = 0; axis < 3; axis++) {
      // Sort chunks by centroid on this axis
      const sorted = chunks.slice(start, end);
      sorted.sort((a, b) => a.centroid[axis] - b.centroid[axis]);

      // Sweep right to left for right bounds
      this.rightBoundsMinBuffer[count - 1] = vec3.create(
        Infinity,
        Infinity,
        Infinity,
      );
      this.rightBoundsMaxBuffer[count - 1] = vec3.create(
        -Infinity,
        -Infinity,
        -Infinity,
      );

      for (let i = count - 1; i >= 0; i--) {
        const chunk = sorted[i];
        if (i === count - 1) {
          vec3.copy(chunk.bboxMin, this.rightBoundsMinBuffer[i]);
          vec3.copy(chunk.bboxMax, this.rightBoundsMaxBuffer[i]);
        } else {
          vec3.min(
            this.rightBoundsMinBuffer[i + 1],
            chunk.bboxMin,
            this.rightBoundsMinBuffer[i],
          );
          vec3.max(
            this.rightBoundsMaxBuffer[i + 1],
            chunk.bboxMax,
            this.rightBoundsMaxBuffer[i],
          );
        }
      }

      // Sweep left to right, evaluate splits
      const lmin = vec3.create(Infinity, Infinity, Infinity);
      const lmax = vec3.create(-Infinity, -Infinity, -Infinity);

      for (let i = 0; i < count - 1; i++) {
        const chunk = sorted[i];
        vec3.min(lmin, chunk.bboxMin, lmin);
        vec3.max(lmax, chunk.bboxMax, lmax);

        const leftCount = i + 1;
        const rightCount = count - leftCount;

        // Calculate surface areas
        const leftSA = this.getSurfaceArea(lmin, lmax);
        const rightSA = this.getSurfaceArea(
          this.rightBoundsMinBuffer[i + 1],
          this.rightBoundsMaxBuffer[i + 1],
        );

        // SAH cost
        const cost =
          (leftSA / parentSA) * leftCount + (rightSA / parentSA) * rightCount;

        if (cost < bestCost) {
          bestCost = cost;
          bestAxis = axis;
          bestPos = i + 1;
        }
      }
    }

    // If no good split, make leaf
    if (bestAxis === -1 || bestCost >= count) {
      node.blasIndex = start;
      node.leafCount = count;
      return node;
    }

    // FIX: Sort chunks by best axis ONCE after finding winner
    const workingSlice = chunks.slice(start, end);
    workingSlice.sort((a, b) => a.centroid[bestAxis] - b.centroid[bestAxis]);

    // Copy sorted chunks back into original array
    for (let i = 0; i < count; i++) {
      chunks[start + i] = workingSlice[i];
    }

    // Recursively build children
    node.left = this.buildBVH(chunks, start, start + bestPos);
    node.right = this.buildBVH(chunks, start + bestPos, end);
    node.blasIndex = -1;

    return node;
  }

  private getSurfaceArea(min: Vec3, max: Vec3): number {
    const dx = max[0] - min[0];
    const dy = max[1] - min[1];
    const dz = max[2] - min[2];
    return 2 * (dx * dy + dy * dz + dz * dx);
  }

  /**
   * Flatten BVH into GPU-friendly array
   */
  private flattenBVH(node: BVHNode): number {
    const nodeIndex = this.tlasNodes.length;

    const tlasNode: TLASNode = {
      bboxMin: vec3.copy(node.bboxMin),
      padding0: 0,
      bboxMax: vec3.copy(node.bboxMax),
      padding1: 0,
      leftChild: 0,
      rightChild: 0,
      blasIndex: node.blasIndex,
      leafCount: node.leafCount,
    };

    this.tlasNodes.push(tlasNode);

    if (node.left && node.right) {
      const leftIdx = this.flattenBVH(node.left);
      const rightIdx = this.flattenBVH(node.right);
      this.tlasNodes[nodeIndex].leftChild = leftIdx;
      this.tlasNodes[nodeIndex].rightChild = rightIdx;
    }

    this.recycleNode(node);

    return nodeIndex;
  }

  /**
   * Update GPU buffers
   */
  private updateGPUBuffers(): void {
    this.updateBLASBuffer();
    this.updateTLASBuffer();
  }

  /**
   * Create or upload BLAS instance buffer
   */
  private updateBLASBuffer(): void {
    const instanceCount = this.blasList.length;
    if (instanceCount === 0) return;

    const requiredByteLength = instanceCount * 80;

    if (!this.blasBuffer || requiredByteLength > this.maxBlasByteCapacity) {
      if (this.blasBuffer) this.blasBuffer.destroy();

      this.maxBlasByteCapacity = Math.max(
        requiredByteLength,
        this.maxBlasByteCapacity * 2 || 1024 * 80,
      );
      this.blasBuffer = this.device.createBuffer({
        size: this.maxBlasByteCapacity,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: false,
      });
    }

    const instanceData = new Uint8Array(requiredByteLength);
    const view = new DataView(instanceData.buffer);

    for (let i = 0; i < instanceCount; i++) {
      const chunk = this.blasList[i];
      const offset = i * 80;

      // meshID (4 bytes)
      view.setUint32(offset, chunk.chunk.allocations[0]?.region ?? 0, true);

      // faceMask (4 bytes)
      view.setUint32(offset + 4, chunk.faceMask, true);

      // padding (8 bytes)
      view.setUint32(offset + 8, 0, true);
      view.setUint32(offset + 12, 0, true);

      // model matrix (64 bytes) - identity with translation
      const matrixOffset = offset + 16;

      view.setFloat32(matrixOffset, 1, true);
      view.setFloat32(matrixOffset + 4, 0, true);
      view.setFloat32(matrixOffset + 8, 0, true);
      view.setFloat32(matrixOffset + 12, 0, true);

      view.setFloat32(matrixOffset + 16, 0, true);
      view.setFloat32(matrixOffset + 20, 1, true);
      view.setFloat32(matrixOffset + 24, 0, true);
      view.setFloat32(matrixOffset + 28, 0, true);

      view.setFloat32(matrixOffset + 32, 0, true);
      view.setFloat32(matrixOffset + 36, 0, true);
      view.setFloat32(matrixOffset + 40, 1, true);
      view.setFloat32(matrixOffset + 44, 0, true);

      view.setFloat32(
        matrixOffset + 48,
        chunk.worldOffset[0] * CHUNK_SIZE,
        true,
      );
      view.setFloat32(
        matrixOffset + 52,
        chunk.worldOffset[1] * CHUNK_SIZE,
        true,
      );
      view.setFloat32(
        matrixOffset + 56,
        chunk.worldOffset[2] * CHUNK_SIZE,
        true,
      );
      view.setFloat32(matrixOffset + 60, 1, true);
    }

    this.device.queue.writeBuffer(this.blasBuffer, 0, instanceData);
  }

  /**
   * Create or upload TLAS node buffer
   */
  private updateTLASBuffer(): void {
    const nodeCount = this.tlasNodes.length;
    if (nodeCount === 0) return;

    const requiredByteLength = nodeCount * 64;

    if (!this.tlasBuffer || requiredByteLength > this.maxTlasByteCapacity) {
      if (this.tlasBuffer) this.tlasBuffer.destroy();

      this.maxTlasByteCapacity = Math.max(
        requiredByteLength,
        this.maxTlasByteCapacity * 2 || 2048 * 64,
      );
      this.tlasBuffer = this.device.createBuffer({
        size: this.maxTlasByteCapacity,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: false,
      });
    }

    const nodeData = new Uint8Array(requiredByteLength);
    const view = new DataView(nodeData.buffer);

    for (let i = 0; i < nodeCount; i++) {
      const node = this.tlasNodes[i];
      const offset = i * 64;

      // bboxMin (12 bytes) + padding
      view.setFloat32(offset, node.bboxMin[0], true);
      view.setFloat32(offset + 4, node.bboxMin[1], true);
      view.setFloat32(offset + 8, node.bboxMin[2], true);
      view.setUint32(offset + 12, node.padding0, true);

      // bboxMax (12 bytes) + padding
      view.setFloat32(offset + 16, node.bboxMax[0], true);
      view.setFloat32(offset + 20, node.bboxMax[1], true);
      view.setFloat32(offset + 24, node.bboxMax[2], true);
      view.setUint32(offset + 28, node.padding1, true);

      // Children and leaf data
      view.setUint32(offset + 32, node.leftChild, true);
      view.setUint32(offset + 36, node.rightChild, true);
      view.setUint32(offset + 40, node.blasIndex, true);
      view.setUint32(offset + 44, node.leafCount, true);
    }

    this.device.queue.writeBuffer(this.tlasBuffer, 0, nodeData);
  }

  public getBLASBuffer(): GPUBuffer | null {
    return this.blasBuffer;
  }
  public getTLASBuffer(): GPUBuffer | null {
    return this.tlasBuffer;
  }
  public getChunkCount(): number {
    return this.blasList.length;
  }
  public getNodeCount(): number {
    return this.tlasNodes.length;
  }
  public markDirty(): void {
    this.needsRebuild = true;
  }

  /**
   * Update chunk face mask
   */
  public updateChunkFaceMask(key: number, faceMask: number): void {
    const chunk = this.chunks.get(key);
    if (chunk) {
      chunk.faceMask = faceMask;
      this.updateBLASBuffer();
    }
  }

  /**
   * Node pooling
   */
  private allocateNode(): BVHNode {
    if (this.nodePool.length > 0) {
      const node = this.nodePool.pop()!;
      node.bboxMin = vec3.create(Infinity, Infinity, Infinity);
      node.bboxMax = vec3.create(-Infinity, -Infinity, -Infinity);
      node.left = null;
      node.right = null;
      node.blasIndex = -1;
      node.leafCount = 0;
      return node;
    }
    return new BVHNode();
  }

  private recycleNode(node: BVHNode): void {
    if (this.nodePool.length < 5000) {
      // Increased pool size
      this.nodePool.push(node);
    }
  }

  /**
   * Debug visualization
   */
  public debugDraw(ctx: CanvasRenderingContext2D, camera: any): void {
    if (!this.root) return;
    this.debugDrawNode(ctx, camera, this.root);
  }

  private debugDrawNode(
    ctx: CanvasRenderingContext2D,
    camera: any,
    node: BVHNode,
  ): void {
    const min = node.bboxMin;
    const max = node.bboxMax;

    if (max[0] < camera.position[0] - 100 || min[0] > camera.position[0] + 100)
      return;
    if (max[2] < camera.position[2] - 100 || min[2] > camera.position[2] + 100)
      return;

    const x = (min[0] - camera.position[0]) * 10 + ctx.canvas.width / 2;
    const z = (min[2] - camera.position[2]) * 10 + ctx.canvas.height / 2;
    const w = (max[0] - min[0]) * 10;
    const h = (max[2] - min[2]) * 10;

    ctx.strokeStyle = node.blasIndex !== -1 ? "#00ff00" : "#ffff00";
    ctx.strokeRect(x, z, w, h);

    if (node.left) this.debugDrawNode(ctx, camera, node.left);
    if (node.right) this.debugDrawNode(ctx, camera, node.right);
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.blasBuffer?.destroy();
    this.tlasBuffer?.destroy();
    this.chunks.clear();
    this.blasList = [];
    this.tlasNodes = [];
    this.nodePool = [];
    this.rightBoundsMinBuffer = [];
    this.rightBoundsMaxBuffer = [];
    this.root = null;
    this.maxBlasByteCapacity = 0;
    this.maxTlasByteCapacity = 0;
  }
}

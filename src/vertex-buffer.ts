import { VERTEX_STRIDES } from "./constants";



export class VertexBuffer {
  public layout: GPUVertexBufferLayout
  public buffer: GPUBuffer



  constructor(formats: GPUVertexFormat[], buffer: GPUBuffer) {
    this.buffer = buffer;
    this.layout = {
      arrayStride: formats.reduce((sum, format) => sum + VERTEX_STRIDES[format], 0),
      attributes: formats.map<GPUVertexAttribute>((format, i) => ({
        shaderLocation: i,
        offset: formats.slice(0, i).reduce((sum, format) => sum + VERTEX_STRIDES[format], 0),
        format,
      })),
    };
  }



  get stride(): number {
    return this.layout.arrayStride;
  }
}
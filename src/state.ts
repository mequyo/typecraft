import { ArenaBuffer } from "./classes/arena-buffer"
import { Minimap } from "./classes/minimap"
import { RingBuffer } from "./classes/ring-buffer"
import { RenderPipeline } from "./render-pipeline"
import { Player } from "./player"
import { World } from "./world"
import { ChunkBlocksComputePipeline } from "./pipeline-descriptors/chunk-blocks-compute-pipeline"
import { InputSystem } from "./input-system"



export type State = {
  canvas: HTMLCanvasElement
  context: GPUCanvasContext
  device: GPUDevice
  adapter: GPUAdapter
  audio: AudioContext

  depthTexture: GPUTexture

  time: {
    last: number
    dt: { cpu: number, gpu: number },
    seconds: number
  }

  world: World
  player: Player

  minimap: Minimap

  performance: {
    cpu: RingBuffer
    gpu: RingBuffer
    chunk_meshing: RingBuffer
    chunk_generation: RingBuffer
  }

  // TEST FOR NOW
  chunkBuffer: ArenaBuffer

  pipelines: RenderPipeline[]

  compute: ChunkBlocksComputePipeline




  input: InputSystem
}
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normals: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) texture: f32,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) texture: f32,
}

@group(0) @binding(0)
var mySampler: sampler;
@group(0) @binding(1)
var myTexture: texture_2d_array<f32>;

@group(1) @binding(0)
var<uniform> projection: mat4x4<f32>;
@group(1) @binding(1)
var<uniform> view: mat4x4<f32>;

// ========================================================================================================================================

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  output.position = projection * view * vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  output.texture = input.texture;

  return output;
}

// ========================================================================================================================================

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let col = textureSample(myTexture, mySampler, input.uv, i32(round(input.texture)));

  return vec4<f32>(col.xyz, col.a * 0.5);
}
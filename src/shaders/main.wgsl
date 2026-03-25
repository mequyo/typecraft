struct VertexInput {
  // [3 bits face, 29 bits chunkIndex]
  @builtin(instance_index) iid: u32,
  // [9 bits local x, 9 bits local y, 9 bits local z]
  @location(0) xyz: u32,
  // [8 bits u, 8 bits v, 16 bits texture]
  @location(1) uvt: u32,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) texture_uv: vec3<f32>,
  @location(2) player_position: vec3<f32>,
  @location(3) block_pos: vec3<f32>,
  @location(4) delta_time: f32,
}

struct Chunk {
  origin: vec3<f32>,
  // time in seconds
  time: f32,
}

@group(0) @binding(0)
var mySampler: sampler;
@group(0) @binding(1)
var myTexture: texture_2d_array<f32>;

@group(1) @binding(0)
var<storage, read> chunks: array<Chunk>;

@group(2) @binding(0)
var<uniform> projection: mat4x4<f32>;
@group(2) @binding(1)
var<uniform> view: mat4x4<f32>;
@group(2) @binding(2)
var<uniform> player_position: vec3<f32>;
@group(2) @binding(3)
var<uniform> time: f32;

const FADE_IN_DURATION = 0.5;

// ========================================================================================================================================

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  var face = input.iid & 7;
  var chunkIndex = input.iid >> 3;
  var chunk = chunks[chunkIndex];

  let local_z = f32(input.xyz & 511) / 4.0;
  let local_y = f32((input.xyz >> 9) & 511) / 4.0;
  let local_x = f32((input.xyz >> 18) & 511) / 4.0;
  let world_position = round(chunk.origin * 32.0) + vec3f(local_x, local_y, local_z);

  output.position = projection * view * vec4f(world_position, 1.0);
  // Derive normal from face
  output.normal = FACE_NORMALS[face];

  // unpack: high 16 bits = U, low 16 bits = V, normalize to [0,1], texture index in xyzt bits
  let u8 = input.uvt & 255u;
  let v8 = (input.uvt >> 8u) & 255u;
  let tex16 = (input.uvt >> 16u) & 65535u;

  output.texture_uv = vec3(f32(u8) / 255.0, f32(v8) / 255.0, f32(tex16));
  output.player_position = player_position;
  output.block_pos = world_position;
  output.delta_time = clamp((time - chunk.time) / FADE_IN_DURATION, 0.0, 1.0);;

  return output;
}

// ========================================================================================================================================

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  var tex = textureSample(myTexture, mySampler, input.texture_uv.xy, i32(round(input.texture_uv.z)));

  if (tex.a < 0.05) {
    discard;
  }

  var albedo = tex.rgb;
  var L = normalize(vec3f(0.0, 1.0, 0.3));
  // light direction, from above-left
  var N = normalize(input.normal);
  var diff = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);

  var color = albedo * diff;
  var dist = length(input.player_position - input.block_pos);
  var fogstart = 50.0;
  var fogend = 500.0;
  var fogfactor = clamp((dist - fogstart) / (fogend - fogstart), 0.0, 1.0);
  var fogcolor = vec3f(186.0 / 255.0, 240.0 / 255.0, 255.0 / 255.0);
  var colorplusfog = mix(color, fogcolor, fogfactor);

  return vec4f(colorplusfog, input.delta_time);
}

const FACE_NORMALS = array<vec3<f32>, 6>(vec3<f32>(1, 0, 0), vec3<f32>(- 1, 0, 0), vec3<f32>(0, 1, 0), vec3<f32>(0, - 1, 0), vec3<f32>(0, 0, 1), vec3<f32>(0, 0, - 1));

fn saturate(x: f32) -> f32 {
  return clamp(x, 0.0, 1.0);
}

fn mod3f(x: vec3<f32>, y: f32) -> vec3<f32> {
  return x - y * floor(x / y);
}
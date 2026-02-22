struct Edge {
  start: vec4<f32>,
  end: vec4<f32>,
}

@group(0) @binding(0)
var<uniform> projection: mat4x4<f32>;
@group(0) @binding(1)
var<uniform> view: mat4x4<f32>;
@group(0) @binding(2)
var<uniform> blockposition: vec3<f32>;
@group(0) @binding(3)
var<uniform> cameraposition: vec3<f32>;

// TODO some blocks might need different origins for scaling like a slab

@vertex
fn vs_main(@location(0) local: vec3<f32>, @location(1) _scrap: f32) -> @builtin(position) vec4<f32> {
  // place the local vertex at the block's world position
  let world_local = local + blockposition;
  let worldpos = projection * view * vec4<f32>(world_local, 1.0);

  return worldpos;
}

@fragment
fn fs_main(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
  return vec4<f32>(1.0, 1.0, 1.0, 0.2);
}
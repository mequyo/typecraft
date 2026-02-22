struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@group(0) @binding(0)
var<uniform> proj_view: mat4x4<f32>;
// inverted(camera.proj) * inverted(camera.view)

// ========================================================================================================================================

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VSOut {
  var positions = array<vec2<f32>, 3>(vec2<f32>(- 1.0, - 1.0), vec2<f32>(3.0, - 1.0), vec2<f32>(- 1.0, 3.0),);

  let pos = positions[vertexIndex];
  var out: VSOut;
  out.position = vec4<f32>(pos, 0.0, 1.0);

  // convert from clip-space (-1..1) to UV (0..1)
  out.uv = pos * 0.5 + vec2<f32>(0.5, 0.5);

  return out;
}

// ========================================================================================================================================

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  // Convert from clip-space (-1..1) to NDC
  let ndc = vec4<f32>(in.uv.x * 2.0 - 1.0, in.uv.y * 2.0 - 1.0, 1.0, 1.0,);

  // Reconstruct world-space position (or direction)
  var worldPos = proj_view * ndc;
  worldPos /= worldPos.w;

  // Extract normalized direction vector
  let dir = normalize(worldPos.xyz);

  // Now use world direction to sample noise in world space
  // e.g. use the horizontal xz plane for clouds
  let n = fbm(dir.xz * 0.5 /*+ vec2<f32>(time * 0.02, 0.0)*/);

  // Convert to cloud mask
  let clouds = smoothstep(0.55, 0.7, n);

  // Sky gradient
  let baseColor = vec3<f32>(175.0 / 255.0, 212.0 / 255.0, 255.0 / 255.0);
  let tintTop = vec3<f32>(10.0 / 255.0, 180.0 / 255.0, 255.0 / 255.0);
  let blue = mix(baseColor, tintTop, pow(in.uv.y, 1.5));

  // Blend clouds into sky
  let color = mix(blue, vec3<f32>(1.0, 1.0, 1.0), clouds);
  return vec4<f32>(color, 1.0);
}

// ========================================================================================================================================

fn fbm(p: vec2<f32>) -> f32 {
  var value = 0.0;
  var amp = 0.5;
  var freq = 1.0;
  for (var i = 0; i < 5; i = i + 1) {
    value += amp * noise2d(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return value;
}

fn hash(p: vec2<f32>) -> f32 {
  let h = sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453123;
  return fract(h);
}

fn lerp(a: f32, b: f32, t: f32) -> f32 {
  return a + t * (b - a);
}

fn noise2d(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);

  // smoothstep curve for interpolation
  let u = f * f * (3.0 - 2.0 * f);

  let a = hash(i + vec2<f32>(0.0, 0.0));
  let b = hash(i + vec2<f32>(1.0, 0.0));
  let c = hash(i + vec2<f32>(0.0, 1.0));
  let d = hash(i + vec2<f32>(1.0, 1.0));

  let x1 = lerp(a, b, u.x);
  let x2 = lerp(c, d, u.x);
  return lerp(x1, x2, u.y);
}

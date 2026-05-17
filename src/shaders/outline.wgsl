@group(0) @binding(0) var<uniform> projection: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<uniform> cameraposition: vec3<f32>;
@group(0) @binding(3) var<uniform> screen_size: vec2<f32>;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) texture: f32,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var position = projection * view * vec4<f32>(input.position, 1.0);

    return VertexOutput(position);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(1.0);
}

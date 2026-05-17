@group(0) @binding(0) var smplr: sampler;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(1) @binding(0) var<uniform> color: vec3<f32>;
@group(1) @binding(1) var<uniform> width: f32;

@vertex
fn vs_main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    var pos = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
    return vec4f(pos[i], 0, 1);
}

@fragment
fn fs_main(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
    let texSize = vec2<f32>(textureDimensions(tex));
    let uv = position.xy / texSize;
    let texel = width / texSize;

    // Sample 3x3 neighborhood (use alpha channel for edge detection)
    let tl = textureSample(tex, smplr, uv + vec2(-texel.x, -texel.y)).a;
    let tc = textureSample(tex, smplr, uv + vec2(0.0, -texel.y)).a;
    let tr = textureSample(tex, smplr, uv + vec2(texel.x, -texel.y)).a;

    let ml = textureSample(tex, smplr, uv + vec2(-texel.x, 0.0)).a;
    let mr = textureSample(tex, smplr, uv + vec2(texel.x, 0.0)).a;

    let bl = textureSample(tex, smplr, uv + vec2(-texel.x, texel.y)).a;
    let bc = textureSample(tex, smplr, uv + vec2(0.0, texel.y)).a;
    let br = textureSample(tex, smplr, uv + vec2(texel.x, texel.y)).a;

    // Sobel operator
    // Gx: [-1  0  1]     Gy: [-1 -2 -1]
    //     [-2  0  2]         [ 0  0  0]
    //     [-1  0  1]         [ 1  2  1]
    let gx = -tl + tr - 2.0 * ml + 2.0 * mr - bl + br;
    let gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
    let gradient = sqrt(gx * gx + gy * gy); // Gradient magnitude
    let edge = smoothstep(0.1, 0.8, gradient); // Antialiased edge with adjustable threshold

    return vec4<f32>(color, edge);
}

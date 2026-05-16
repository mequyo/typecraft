struct VertexInput {
    @builtin(instance_index) iid: u32, // [3 bits face, 29 bits chunkIndex]
    @location(0) xyz: u32, // [9 bits local x, 9 bits local y, 9 bits local z]
    @location(1) uvt: u32, // [8 bits u, 8 bits v, 16 bits texture]
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) texture_uv: vec3<f32>,
    @location(2) player_position: vec3<f32>,
    @location(3) world_position: vec3<f32>,
    @location(4) delta_time: f32,
}

struct Chunk {
    origin: vec3<i32>,
    time: f32, // in seconds
}

@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d_array<f32>;

@group(1) @binding(0) var<storage, read> chunks: array<Chunk>;

@group(2) @binding(0) var<uniform> projection: mat4x4<f32>;
@group(2) @binding(1) var<uniform> view: mat4x4<f32>;
@group(2) @binding(2) var<uniform> player_position: vec3<f32>;
@group(2) @binding(3) var<uniform> time: f32;
@group(2) @binding(4) var<uniform> lookat: vec3<f32>;

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
    let world_position = vec3f(chunk.origin * 32) + vec3f(local_x, local_y, local_z);

    output.position = projection * view * vec4f(f32(world_position.x), f32(world_position.y), f32(world_position.z), 1.0);
    output.normal = FACE_NORMALS[face]; // Derive normal from face

    // unpack: high 16 bits = U, low 16 bits = V, normalize to [0,1], texture index in xyzt bits
    let u8 = input.uvt & 255u;
    let v8 = (input.uvt >> 8u) & 255u;
    let tex16 = (input.uvt >> 16u) & 65535u;

    output.texture_uv = vec3(f32(u8) / 255.0, f32(v8) / 255.0, f32(tex16));
    output.player_position = player_position;
    output.world_position = world_position;
    output.delta_time = clamp((time - chunk.time) / FADE_IN_DURATION, 0.0, 1.0);;

    return output;
}

// ========================================================================================================================================

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
    let uv = input.texture_uv;
    var tex = textureSample(myTexture, mySampler, uv.xy, i32(round(uv.z)));

    if tex.a < 0.05 { discard; }

    var albedo = tex.rgb;
    var L = normalize(vec3f(0.0, 1.0, 0.3)); // light direction, from above-left
    var N = normalize(input.normal);
    var diff = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);

    var color = albedo * diff;
    var dist = 0.0; //length(input.player_position - input.world_position);
    var fogstart = 50.0;
    var fogend = 500.0;
    var fogfactor = clamp((dist - fogstart) / (fogend - fogstart), 0.0, 1.0);
    var fogcolor = vec3f(186.0 / 255.0, 240.0 / 255.0, 255.0 / 255.0);
    var colorplusfog = mix(color, fogcolor, fogfactor);

    // Outline
    let eps = vec3f(0.00005);
    let flr = abs(floor(input.world_position - eps - lookat));
    let cel = abs(floor(input.world_position + eps - lookat));
    let border_width = 1.0 / 16.0;
    let border_color = vec3f(1.0, 1.0, 1.0);
    if all(flr < eps) || all(cel < eps) {
        if uv.x < border_width || uv.x > 1.0 - border_width || uv.y < border_width || uv.y > 1.0 - border_width {
            //colorplusfog = border_color;
        }
    }

    return vec4f(colorplusfog, input.delta_time);
}

const FACE_NORMALS = array<vec3<f32>, 6>(vec3<f32>(1, 0, 0), vec3<f32>(- 1, 0, 0), vec3<f32>(0, 1, 0), vec3<f32>(0, -1, 0), vec3<f32>(0, 0, 1), vec3<f32>(0, 0, -1));

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

fn mod3f(x: vec3<f32>, y: f32) -> vec3<f32> {
    return x - y * floor(x / y);
}

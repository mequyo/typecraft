@group(0) @binding(0) var<uniform> projection: mat4x4<f32>;
@group(0) @binding(1) var<uniform> view: mat4x4<f32>;
@group(0) @binding(2) var<uniform> cameraposition: vec3<f32>;
@group(0) @binding(3) var<uniform> screen_size: vec2<f32>;

struct VertexInput {
    @location(0) start_pos: vec3<f32>,
    @location(1) end_pos: vec3<f32>,
    @location(2) quad_coord: vec2<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) @interpolate(linear) local_pos: vec2f,
    @location(1) @interpolate(flat) line_length: f32,
}

const THICKNESS = 5.0; // Total width in pixels
const COLOR = vec3<f32>(0.4, 0.8, 1.0);

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var p1 = projection * view * vec4<f32>(input.start_pos, 1.0);
    var p2 = projection * view * vec4<f32>(input.end_pos, 1.0);

    // --- 1. CLIP TO NEAR PLANE ---
    // If both are behind the near plane, discard by moving off-screen
    if p1.z < 0.0 && p2.z < 0.0 {
        return VertexOutput(vec4<f32>(0.0, 0.0, 0.0, 0.0), vec2<f32>(0.0), 0.0);
    }

    // If only one is behind, find the intersection with the near plane (z=0)
    if p1.z < 0.0 {
        let t = (0.0 - p1.z) / (p2.z - p1.z);
        p1 = mix(p1, p2, t);
    } else if p2.z < 0.0 {
        let t = (0.0 - p2.z) / (p1.z - p2.z);
        p2 = mix(p2, p1, t);
    }

    // --- 2. SCREEN SPACE MATH ---
    let ndc1 = p1.xy / p1.w;
    let ndc2 = p2.xy / p2.w;

    let aspect = screen_size.x / screen_size.y;
    let screen_p1 = ndc1 * vec2<f32>(aspect, 1.0);
    let screen_p2 = ndc2 * vec2<f32>(aspect, 1.0);

    let delta = screen_p2 - screen_p1;
    let line_len = length(delta);
    let dir = delta / line_len;
    let perp = vec2<f32>(-dir.y, dir.x);
    let radius_ndc = (THICKNESS) / screen_size.y; // radius in 'vertical NDC' units

    // Expand quad by 1 radius to fit rounded caps
    let is_end = f32(input.quad_coord.x > 0.5);
    let side = input.quad_coord.y; // Assumed -1.0 or 1.0

    let offset = (dir * (is_end * 2.0 - 1.0) + perp * side) * radius_ndc;
    let current_screen = mix(screen_p1, screen_p2, is_end);
    let final_screen = current_screen + offset;

    // --- 3. INTERPOLATION ---
    let final_ndc = vec2<f32>(final_screen.x / aspect, final_screen.y);
    let current_w = mix(p1.w, p2.w, is_end); // Use the appropriate W to ensure screen-space linearity
    let current_z = mix(p1.z, p2.z, is_end); // Pull the depth slightly towards the camera to prevent Z-fighting
    let depth_bias = 0.0002 * current_w; // Tweak 0.005 if needed based on scale
    let pixel_radius = THICKNESS * 0.5; // Pixel-scale coordinates for the fragment shader
    let pixel_len = line_len * (screen_size.y * 0.5);

    var out: VertexOutput;
    out.position = vec4f(final_ndc * current_w, current_z - depth_bias, current_w);
    out.line_length = pixel_len;
    out.local_pos = vec2f(
        mix(-pixel_radius, pixel_len + pixel_radius, is_end),
        side * pixel_radius
    );

    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    // Calculate distance to the line segment in 2D pixel space
    let radius = THICKNESS * 0.5;
    let dx = max(0.0, max(-in.local_pos.x, in.local_pos.x - in.line_length));
    let dy = in.local_pos.y;
    let dist = sqrt(dx * dx + dy * dy);
    let alpha = 1.0 - smoothstep(radius - 1.0, radius, dist); // Smoothstep for high-quality anti-aliasing

    if alpha <= 0.0 { discard; }

    return vec4f(COLOR, alpha); // A nice Minecraft-selection blue
}

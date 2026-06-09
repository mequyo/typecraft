struct VertexInput {
    @builtin(instance_index) iid: u32, // [3 bits face, 29 bits indirectionIndex]
    @location(0) xyz: u32, // [10 bits local x, 10 bits local y, 10 bits local z]
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
    blocks: array<i32, 32768>,
    origin: vec3<i32>,
    time: i32, // in milliseconds
}

@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d_array<f32>;

@group(1) @binding(0) var<storage, read> chunks: array<Chunk>;
@group(1) @binding(1) var<storage, read> indirection: array<u32>; // Maps xyz -> index in chunks

@group(2) @binding(0) var<uniform> projection: mat4x4<f32>;
@group(2) @binding(1) var<uniform> view: mat4x4<f32>;
@group(2) @binding(2) var<uniform> player_position: vec3<f32>;
@group(2) @binding(3) var<uniform> time: f32;
@group(2) @binding(4) var<uniform> lookat: vec3<f32>;
@group(2) @binding(5) var<uniform> indirectionGridSize: u32; // Is the indirection grid size
@group(2) @binding(6) var<uniform> indirectionOrigin: vec3<i32>;
@group(2) @binding(7) var<uniform> air_ID: i32;

const FADE_IN_DURATION = 0.5;
const FACE_NORMALS = array<vec3<f32>, 6>(
    vec3<f32>(1, 0, 0),
    vec3<f32>(-1, 0, 0),
    vec3<f32>(0, 1, 0),
    vec3<f32>(0, -1, 0),
    vec3<f32>(0, 0, 1),
    vec3<f32>(0, 0, -1),
);
const CHUNK_SIZE = 32;
const INVALID_CHUNK = 0xffffffffu;

// FOG
const FOG_COLOR = vec3<f32>(0.73, 0.94, 1.00);
const FOG_START = 100.0; // At what distance fog starts appearing
const FOG_END = 500.0; // At what distance fog is maxed

// DURING DAY
const SUN_DIRECTION = vec3<f32>(0.2, 1.0, 0.4); // TODO move during day light cycle
const SUN_COLOR = vec3<f32>(1.0, 0.95, 0.85); // TODO change during the day and night
const AMBIENT_COLOR = vec3<f32>(0.3, 0.3, 0.4); // TODO change during the day
const CONE_ANGLE = 0.1; // 5.7°  smaller = sharper edges, larger = very soft shadows
const CONE_TRACING_ITERATIONS = 64;

// GI
const SKY_RADIANCE = vec3<f32>(0.8, 0.6, 1.0);      // sky light color
const INDIRECT_SAMPLE_COUNT = 8u;                  // number of cone directions per pixel
const MAX_CONE_DIST = 20.0;                        // max distance for indirect tracing

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    var face = input.iid & 7;
    var indirectionID = input.iid >> 3;
    var chunkIndex = indirection[indirectionID];
    var chunk = chunks[chunkIndex];

    let local_z = f32((input.xyz >> 0) & 1023) / 16.0;
    let local_y = f32((input.xyz >> 10) & 1023) / 16.0;
    let local_x = f32((input.xyz >> 20) & 1023) / 16.0;
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
    output.delta_time = clamp((time - f32(chunk.time) / 1000.0) / FADE_IN_DURATION, 0.0, 1.0);;

    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
    let uv = input.texture_uv;

    let albedo = getAlbedo(i32(round(uv.z)), uv.xy);

    if albedo.a < 0.05 { discard; }

    let N = normalize(input.normal);
    let direct = computeDirectLighting(input.world_position, N, albedo.rgb);
    //let indirect = computeIndirectLighting(input.world_position, N);
    let color = direct;

    // FOG
    var dist = distance(input.world_position, player_position);
    var fogfactor = clamp((dist - FOG_START) / (FOG_END - FOG_START), 0.0, 1.0);
    var final_color = mix(color, FOG_COLOR, fogfactor);

    return vec4f(final_color, input.delta_time);
}

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

fn pack_chunk_coord(chunkPos: vec3<i32>) -> u32 {
    let half = i32(indirectionGridSize >> 1);
    let relative = chunkPos - indirectionOrigin + half;

    if relative.x < 0 || relative.y < 0 || relative.z < 0 { return INVALID_CHUNK; }
    if relative.x >= i32(indirectionGridSize) || relative.y >= i32(indirectionGridSize) || relative.z >= i32(indirectionGridSize) { return INVALID_CHUNK; }

    let x = u32(relative.x) * indirectionGridSize * indirectionGridSize;
    let y = u32(relative.y) * indirectionGridSize;
    let z = u32(relative.z);
    return x + y + z;
}

// return 0 if air
fn getVoxel(pos: vec3<i32>) -> i32 {
    // Convert world position to chunk + local
    let chunkPos = vec3<i32>(floor(vec3<f32>(pos)) / f32(CHUNK_SIZE));
    let localPos = pos - chunkPos * CHUNK_SIZE;

    // Pack chunk coordinates for indirection lookup
    let packed = pack_chunk_coord(chunkPos);
    if packed == INVALID_CHUNK { return 0; }

    let chunkIndex = indirection[packed];
    if chunkIndex == INVALID_CHUNK { return 0; }

    // Index into chunk's block array
    let blockIndex = localPos.x * CHUNK_SIZE * CHUNK_SIZE + localPos.y * CHUNK_SIZE + localPos.z;
    return chunks[chunkIndex].blocks[blockIndex];
}

fn traceConeShadow(origin: vec3<f32>, direction: vec3<f32>, coneAngle: f32) -> f32 {
    var pos = origin + direction * 0.1;
    var occlusion = 0.0;
    var coneRadius = 0.0;

    for (var i = 0; i < CONE_TRACING_ITERATIONS; i++) {
        let dist = f32(i) * 0.5;
        coneRadius = dist * tan(coneAngle);

        // Sample voxels within cone radius
        let sampleRadius = max(1.0, coneRadius);
        let voxelPos = vec3<i32>(floor(pos));

        // Simple: check center voxel, weighted by cone size
        // TODO every block currently has 24 orientations, including air
        if getVoxel(voxelPos) != air_ID {
            let coverage = min(1.0, sampleRadius);
            occlusion += coverage * 0.1;
            if occlusion >= 1.0 {
                return 0.0; // Fully occluded
            }
        }

        pos += direction * max(0.5, coneRadius * 0.5);
    }

    return 1.0 - saturate(occlusion);
}

fn computeDirectLighting(worldPos: vec3<f32>, normal: vec3<f32>, albedo: vec3<f32>) -> vec3<f32> {
    let L = normalize(SUN_DIRECTION);
    let N = normalize(normal);
    let diff = max(dot(N, L), 0.0);
    let shadow = traceConeShadow(worldPos, L, CONE_ANGLE);

    return albedo * (AMBIENT_COLOR + SUN_COLOR * shadow * diff);
}

// Improved cone trace that returns the radiance (color) coming from a given direction.
// It steps through the voxel grid, and when it hits a solid voxel, returns the direct lighting
// of that surface. If no hit within MAX_CONE_DIST, returns SKY_RADIANCE.
fn traceConeRadiance(origin: vec3<f32>, direction: vec3<f32>, coneAngle: f32) -> vec3<f32> {
    var pos = origin + direction * 0.1;
    var coneRadius = 0.0;
    for (var i = 0; i < CONE_TRACING_ITERATIONS; i++) {
        let dist = f32(i) * 0.5;
        if dist > MAX_CONE_DIST { break; }
        coneRadius = dist * tan(coneAngle);
        let voxelPos = vec3<i32>(floor(pos));
        let blockType = getVoxel(voxelPos);
        //let albedo = getAlbedo(blockType, vec2f(0.0, 0.0));
        let albedo = vec3f(0.3, 0.8, 0.8);

        if blockType > 23 {
            // Hit a solid block – compute its direct lighting at that hit point.
            // Approximate surface normal from the direction to the voxel center.
            // For simplicity we use the face normal based on the hit side.
            let hitPos = vec3<f32>(voxelPos) + vec3<f32>(0.5);
            let hitNormal = -normalize(direction);  // crude, but good enough for diffuse

            return computeDirectLighting(hitPos, hitNormal, albedo.rgb);
        }
        pos += direction * max(0.5, coneRadius * 0.5);
    }
    // No hit – return sky radiance
    return SKY_RADIANCE;
}

fn getAlbedo(blockID: i32, uv: vec2<f32>) -> vec4<f32> {
    return textureSample(myTexture, mySampler, uv, blockID);
}

// Generates a set of directions distributed over the hemisphere around N.
// Uses the Fibonacci spiral method.
fn getHemisphereDirection(index: u32, count: u32, N: vec3<f32>) -> vec3<f32> {
    let phi = 2.0 * 3.1415926 * f32(index) / f32(count);
    let cosTheta = 1.0 - f32(index) / f32(count);  // bias toward horizon
    let sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    let localDir = vec3<f32>(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
    // Build orthonormal basis
    let up = vec3<f32>(0.0, 1.0, 0.0);
    let tangent = normalize(cross(up, N));
    let bitangent = cross(N, tangent);
    return tangent * localDir.x + bitangent * localDir.y + N * localDir.z;
}

// Indirect diffuse lighting: average radiance over hemisphere
fn computeIndirectLighting(pos: vec3<f32>, N: vec3<f32>) -> vec3<f32> {
    var totalRadiance = vec3<f32>(0.0);
    for (var i = 0u; i < INDIRECT_SAMPLE_COUNT; i++) {
        let dir = getHemisphereDirection(i, INDIRECT_SAMPLE_COUNT, N);
        let radiance = traceConeRadiance(pos + N * 0.05, dir, CONE_ANGLE);
        totalRadiance += radiance;
    }
    return totalRadiance / f32(INDIRECT_SAMPLE_COUNT);
}

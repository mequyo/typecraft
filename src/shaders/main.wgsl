struct VertexInput {
    @builtin(instance_index) iid: u32, // [3 bits face, 29 bits indirectionIndex]
    @location(0) xyz: u32, // [10 bits local x, 10 bits local y, 10 bits local z]
    @location(1) uvt: u32, // [8 bits u, 8 bits v, 16 bits texture]
}
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) textureUV: vec3<f32>,
    @location(2) cameraPosition: vec3<f32>,
    @location(3) worldPosition: vec3<f32>,
    @location(4) deltaTime: f32,
}
struct Chunk {
    blocks: array<i32, 32768>,
    origin: vec3<i32>,
    time: i32, // in milliseconds
}
struct FloatInputs {
    projection: mat4x4<f32>, // Projection matrix
    view: mat4x4<f32>, // View matrix
    cameraPosition: vec3<f32>, // Position of the camera
    lookat: vec3<f32>, // Look-at matrix of camera
    timeInSeconds: f32, // Global time of world
    fadeInDuration: f32, // Time it takes for a chunk to reach opacity 100% in seconds
    // FOG
    fogStart: f32, // Distance at which fog starts accumulating
    fogEnd: f32, // Distance at which fog reaches max strength
    fogColor: vec3<f32>, // Fog color
    // GI
    sunDirection: vec3<f32>, // Direction of the sun
    sunColor: vec3<f32>, // Tint of sun
    ambientColor: vec3<f32>, // Ambient color
    // CONE TRACING
    skyRadiance: vec3<f32>, // sky light color
    coneAngle: f32, // smaller = sharper edges, larger = very soft shadows
    coneDistance: f32, // How far a cone can look
}
struct IntegerInputs {
    indirectionOrigin: vec3<i32>, // Center of the indirection grid
    indirectionGridSize: i32, // The indirection grid size
    airID: i32, // Blockstate ID of air
    chunkSize: i32, // size of a chunk on one axis, 32
    // CONE TRACING
    coneTracingIterations: i32, // Amount of iterations per cone
    indirectSampleCount: i32, // number of cone directions per pixel
}

@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d_array<f32>;

@group(1) @binding(0) var<storage, read> chunks: array<Chunk>;
@group(1) @binding(1) var<storage, read> indirection: array<u32>; // Maps xyz -> index in chunks

@group(2) @binding(0) var<uniform> floats: FloatInputs;
@group(2) @binding(1) var<uniform> integers: IntegerInputs;

const FACE_NORMALS = array<vec3<f32>, 6>(
    vec3<f32>(1, 0, 0),
    vec3<f32>(-1, 0, 0),
    vec3<f32>(0, 1, 0),
    vec3<f32>(0, -1, 0),
    vec3<f32>(0, 0, 1),
    vec3<f32>(0, 0, -1),
);
const INVALID_CHUNK = 0xffffffffu;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    let projection = floats.projection;
    let view = floats.view;
    let cameraPosition = floats.cameraPosition;
    let time = floats.timeInSeconds;

    var output: VertexOutput;
    var face = input.iid & 7;
    var indirectionID = input.iid >> 3;
    var chunkIndex = indirection[indirectionID];
    var chunk = chunks[chunkIndex];

    let localZ = f32((input.xyz >> 0) & 1023) / 16.0;
    let localY = f32((input.xyz >> 10) & 1023) / 16.0;
    let localX = f32((input.xyz >> 20) & 1023) / 16.0;
    let worldPosition = vec3f(chunk.origin * 32) + vec3f(localX, localY, localZ);

    output.position = projection * view * vec4f(f32(worldPosition.x), f32(worldPosition.y), f32(worldPosition.z), 1.0);
    output.normal = FACE_NORMALS[face]; // Derive normal from face

    // unpack: high 16 bits = U, low 16 bits = V, normalize to [0,1], texture index in xyzt bits
    let u8 = input.uvt & 255u;
    let v8 = (input.uvt >> 8u) & 255u;
    let tex16 = (input.uvt >> 16u) & 65535u;

    output.textureUV = vec3(f32(u8) / 255.0, f32(v8) / 255.0, f32(tex16));
    output.cameraPosition = cameraPosition;
    output.worldPosition = worldPosition;
    output.deltaTime = clamp((time - f32(chunk.time) / 1000.0) / floats.fadeInDuration, 0.0, 1.0);;

    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
    let uv = input.textureUV;
    let cameraPosition = floats.cameraPosition;
    let albedo = getAlbedo(i32(round(uv.z)), uv.xy);

    if albedo.a < 0.05 { discard; }

    let N = normalize(input.normal);
    let direct = computeDirectLighting(input.worldPosition, N, albedo.rgb);
    let color = direct;

    // FOG
    var dist = distance(input.cameraPosition, cameraPosition);
    var fogFactor = clamp((dist - floats.fogStart) / (floats.fogEnd - floats.fogStart), 0.0, 1.0);
    var finalColor = mix(color, floats.fogColor, fogFactor);

    return vec4f(finalColor, input.deltaTime);
}

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

fn packChunkCoord(chunkPos: vec3<i32>) -> u32 {
    let size = integers.indirectionGridSize;
    let half = size >> 1;
    let relative = chunkPos - integers.indirectionOrigin + half;

    if relative.x < 0 || relative.y < 0 || relative.z < 0 { return INVALID_CHUNK; }
    if relative.x >= size || relative.y >= size || relative.z >= size { return INVALID_CHUNK; }

    let x = relative.x * size * size;
    let y = relative.y * size;
    let z = relative.z;
    return u32(x + y + z);
}

// return 0 if air
fn getVoxel(pos: vec3<i32>) -> i32 {
    let chunkSize = integers.chunkSize;

    // Convert world position to chunk + local
    let chunkPos = vec3<i32>(floor(vec3<f32>(pos)) / f32(chunkSize));
    let localPos = pos - chunkPos * chunkSize;

    // Pack chunk coordinates for indirection lookup
    let packed = packChunkCoord(chunkPos);
    if packed == INVALID_CHUNK { return 0; }

    let chunkIndex = indirection[packed];
    if chunkIndex == INVALID_CHUNK { return 0; }

    // Index into chunk's block array
    let blockIndex = localPos.x * chunkSize * chunkSize + localPos.y * chunkSize + localPos.z;
    return chunks[chunkIndex].blocks[blockIndex];
}

fn traceConeShadow(origin: vec3<f32>, direction: vec3<f32>, coneAngle: f32) -> f32 {
    var pos = origin + direction * 0.1;
    var occlusion = 0.0;
    var coneRadius = 0.0;

    for (var i = 0; i < integers.coneTracingIterations; i++) {
        let dist = f32(i) * 0.5;
        coneRadius = dist * tan(coneAngle);

        // Sample voxels within cone radius
        let sampleRadius = max(1.0, coneRadius);
        let voxelPos = vec3<i32>(floor(pos));

        // Simple: check center voxel, weighted by cone size
        // TODO every block currently has 24 orientations, including air
        if getVoxel(voxelPos) != integers.airID {
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
    let L = normalize(floats.sunDirection);
    let N = normalize(normal);
    let diff = max(dot(N, L), 0.0);
    let shadow = traceConeShadow(worldPos, L, floats.coneAngle);

    return albedo * (floats.ambientColor + floats.sunColor * shadow * diff);
}

// Improved cone trace that returns the radiance (color) coming from a given direction.
// It steps through the voxel grid, and when it hits a solid voxel, returns the direct lighting
// of that surface. If no hit within MAX_CONE_DIST, returns SKY_RADIANCE.
fn traceConeRadiance(origin: vec3<f32>, direction: vec3<f32>, coneAngle: f32) -> vec3<f32> {
    var pos = origin + direction * 0.1;
    var coneRadius = 0.0;
    for (var i = 0; i < integers.coneTracingIterations; i++) {
        let dist = f32(i) * 0.5;
        if dist > floats.coneDistance { break; }
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
    return floats.skyRadiance;
}

fn getAlbedo(blockID: i32, uv: vec2<f32>) -> vec4<f32> {
    return textureSample(myTexture, mySampler, uv, blockID);
}

// Generates a set of directions distributed over the hemisphere around N.
// Uses the Fibonacci spiral method.
fn getHemisphereDirection(index: i32, count: i32, N: vec3<f32>) -> vec3<f32> {
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
    for (var i = 0; i < integers.indirectSampleCount; i++) {
        let dir = getHemisphereDirection(i, integers.indirectSampleCount, N);
        let radiance = traceConeRadiance(pos + N * 0.05, dir, floats.coneAngle);
        totalRadiance += radiance;
    }
    return totalRadiance / f32(integers.indirectSampleCount);
}

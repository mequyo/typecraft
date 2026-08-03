struct ChunkMeta {
    min: vec3f,
    _pad0: f32,
    max: vec3f,
    _pad1: f32,
    faceVertexCount: vec4u,
    faceVertexCount2: vec4u,
    faceFirstVertex: vec4u,
    faceFirstVertex2: vec4u,
    offset: vec3f,
    _pad2: f32,   // chunk-space offset, used to derive indirection ID
    _padEnd: vec4u,              // reserved
};

@group(0) @binding(0) var<storage, read> chunks: array<ChunkMeta>;
@group(0) @binding(1) var<uniform> planes: array<vec4f, 6>;
@group(0) @binding(2) var<storage, read_write> indirect: array<u32>;
@group(0) @binding(3) var<uniform> cullParams: vec4<i32>; // xyz = origin, w = renderDistance

fn vertexCount(c: ChunkMeta, f: u32) -> u32 {
    return select(c.faceVertexCount2[f - 4u], c.faceVertexCount[f], f < 4u);
}
fn firstVertex(c: ChunkMeta, f: u32) -> u32 {
    return select(c.faceFirstVertex2[f - 4u], c.faceFirstVertex[f], f < 4u);
}

fn packIndirection(rel: vec3i, renderDistance: i32) -> u32 {
    let gridSize = 2 * renderDistance + 1;
    let half = gridSize >> 1;
    let l = rel + vec3i(half, half, half);
    if any(l < vec3i(0, 0, 0)) || any(l >= vec3i(gridSize, gridSize, gridSize)) {
        return 0xffffffffu;
    }
    return u32(l.x * gridSize * gridSize + l.y * gridSize + l.z);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
    let slot = id.x;
    if slot >= arrayLength(&chunks) { return; }

    let c = chunks[slot];

    var frustumVisible = true;
    for (var p = 0u; p < 6u; p++) {
        let n = planes[p];
        let x = select(c.min.x, c.max.x, n.x >= 0.0);
        let y = select(c.min.y, c.max.y, n.y >= 0.0);
        let z = select(c.min.z, c.max.z, n.z >= 0.0);
        if n.x * x + n.y * y + n.z * z + n.w < 0.0 {
            frustumVisible = false;
            break;
        }
    }

    let origin = cullParams.xyz;
    let renderDistance = cullParams.w;
    let rel = vec3i(i32(c.offset.x), i32(c.offset.y), i32(c.offset.z)) - origin;
    let packed = packIndirection(rel, renderDistance);

    let visible = frustumVisible && (packed != 0xffffffffu);

    for (var f = 0u; f < 6u; f++) {
        let base = (slot * 6u + f) * 4u;
        indirect[base + 0u] = select(0u, vertexCount(c, f), visible);
        indirect[base + 1u] = 1u;
        indirect[base + 2u] = firstVertex(c, f);
        indirect[base + 3u] = select(0u, (packed << 3u) | f, visible);
    }
}

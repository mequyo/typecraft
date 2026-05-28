struct Params {
    chunk_offset: vec3<f32>,
    chunk_size: f32,
  // chunk position
}

@group(0) @binding(0)
var<uniform> params: Params;
@group(0) @binding(1)
var<storage, read_write> blocks: array<f32>;

fn idx(x: f32, y: f32, z: f32) -> u32 {
    return u32(x * params.chunk_size * params.chunk_size + y * params.chunk_size + z);
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let x = f32(gid.x);
    let y = f32(gid.y);
    let z = f32(gid.z);

    if x >= params.chunk_size || y >= params.chunk_size || z >= params.chunk_size {
        return;
    }

    let offset = params.chunk_offset * params.chunk_size;
    let height = offset.y + y;

    blocks[idx(x, y, z)] = select(0.0, 1.0, height < 60.0);
}

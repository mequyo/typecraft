export const cube = {
  write_right_face: (
    buffer: Float32Array,
    offset: number,
    x: number,
    y: number,
    z: number,
    texture: number,
    scale: number,
  ): number => {
    const max = scale;
    const pad = 1 - scale;

    buffer[offset++] = x + max;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + pad; // xyz
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 0; // normal
    buffer[offset++] = 1;
    buffer[offset++] = 1;
    buffer[offset++] = texture; // uv + texture ID

    buffer[offset++] = x + max;
    buffer[offset++] = y + max;
    buffer[offset++] = z + pad;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + max;
    buffer[offset++] = y + max;
    buffer[offset++] = z + max;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + max;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + pad;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    buffer[offset++] = x + max;
    buffer[offset++] = y + max;
    buffer[offset++] = z + max;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + max;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + max;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    return 54;
  },

  write_left_face: (
    buffer: Float32Array,
    offset: number,
    x: number,
    y: number,
    z: number,
    texture: number,
    scale: number,
  ): number => {
    const pad = 1 - scale;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + scale;
    buffer[offset++] = -1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + scale;
    buffer[offset++] = z + scale;
    buffer[offset++] = -1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + scale;
    buffer[offset++] = z + pad;
    buffer[offset++] = -1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + scale;
    buffer[offset++] = -1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + scale;
    buffer[offset++] = z + pad;
    buffer[offset++] = -1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + pad;
    buffer[offset++] = -1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    return 54;
  },

  write_top_face: (
    buffer: Float32Array,
    offset: number,
    x: number,
    y: number,
    z: number,
    texture: number,
    scale: number,
  ): number => {
    const pad = 1 - scale;
    buffer[offset++] = x + pad;
    buffer[offset++] = y + scale;
    buffer[offset++] = z + pad;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + scale;
    buffer[offset++] = z + scale;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + scale;
    buffer[offset++] = y + scale;
    buffer[offset++] = z + scale;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + scale;
    buffer[offset++] = z + pad;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    buffer[offset++] = x + scale;
    buffer[offset++] = y + scale;
    buffer[offset++] = z + scale;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + scale;
    buffer[offset++] = y + scale;
    buffer[offset++] = z + pad;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    return 54;
  },

  write_bottom_face: (
    buffer: Float32Array,
    offset: number,
    x: number,
    y: number,
    z: number,
    texture: number,
    scale: number,
  ): number => {
    const pad = 1 - scale;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + scale;
    buffer[offset++] = 0;
    buffer[offset++] = -1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + pad;
    buffer[offset++] = 0;
    buffer[offset++] = -1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + scale;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + pad;
    buffer[offset++] = 0;
    buffer[offset++] = -1;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + scale;
    buffer[offset++] = 0;
    buffer[offset++] = -1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    buffer[offset++] = x + scale;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + pad;
    buffer[offset++] = 0;
    buffer[offset++] = -1;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + scale;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + scale;
    buffer[offset++] = 0;
    buffer[offset++] = -1;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    return 54;
  },

  write_front_face: (
    buffer: Float32Array,
    offset: number,
    x: number,
    y: number,
    z: number,
    texture: number,
    scale: number,
  ): number => {
    const pad = 1 - scale;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + scale;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    buffer[offset++] = x + scale;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + scale;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 1;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    buffer[offset++] = x + scale;
    buffer[offset++] = y + scale;
    buffer[offset++] = z + scale;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + scale;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    buffer[offset++] = x + scale;
    buffer[offset++] = y + scale;
    buffer[offset++] = z + scale;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + scale;
    buffer[offset++] = z + scale;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    return 54;
  },

  write_back_face: (
    buffer: Float32Array,
    offset: number,
    x: number,
    y: number,
    z: number,
    texture: number,
    scale: number,
  ): number => {
    const pad = 1 - scale;

    buffer[offset++] = x + scale;
    buffer[offset++] = y + +pad;
    buffer[offset++] = z + +pad;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = -1;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + pad;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = -1;
    buffer[offset++] = 1;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + scale;
    buffer[offset++] = z + pad;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = -1;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + scale;
    buffer[offset++] = y + pad;
    buffer[offset++] = z + pad;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = -1;
    buffer[offset++] = 0;
    buffer[offset++] = 1;
    buffer[offset++] = texture;

    buffer[offset++] = x + pad;
    buffer[offset++] = y + scale;
    buffer[offset++] = z + pad;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = -1;
    buffer[offset++] = 1;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    buffer[offset++] = x + scale;
    buffer[offset++] = y + scale;
    buffer[offset++] = z + pad;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = -1;
    buffer[offset++] = 0;
    buffer[offset++] = 0;
    buffer[offset++] = texture;

    return 54;
  },

  write_all: (
    buffer: Float32Array,
    offset: number,
    x: number,
    y: number,
    z: number,
    texture: number,
    scale: number,
  ): number => {
    offset += cube.write_back_face(buffer, offset, x, y, z, texture, scale);
    offset += cube.write_bottom_face(buffer, offset, x, y, z, texture, scale);
    offset += cube.write_front_face(buffer, offset, x, y, z, texture, scale);
    offset += cube.write_left_face(buffer, offset, x, y, z, texture, scale);
    offset += cube.write_right_face(buffer, offset, x, y, z, texture, scale);
    offset += cube.write_top_face(buffer, offset, x, y, z, texture, scale);

    return 324;
  },
};

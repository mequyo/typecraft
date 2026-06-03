export type TextureName = string & { _: "texture name" };
export type TextureData = {
  url: string;
  bitmap: ImageBitmap;
  name: TextureName;
  data: ImageData;
};

export class Texture {
  static async create(url: string, name?: string): Promise<TextureData> {
    const bitmap = await fetch(url)
      .then((r) => r.blob())
      .then(createImageBitmap);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    if (!name) name = url.split("/").at(-1)!.replace(".png", "");
    return { url, bitmap, name: name as TextureName, data };
  }
}

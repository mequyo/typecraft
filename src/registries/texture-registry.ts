export type TextureID = number;

export type TextureDefinition = {
  url: string;
};

export type Texture = TextureDefinition & {
  ID: TextureID;
  bitmap?: ImageBitmap;
};

export class TextureRegistry {
  private static textures: Texture[] = [];

  static register(definition: TextureDefinition): Texture {
    const texture: Texture = { ...definition, ID: this.textures.length };
    this.textures.push(texture);
    return texture;
  }

  static get(texture: TextureID): Texture {
    return this.textures[texture];
  }

  static getAll(): Texture[] {
    return this.textures;
  }

  static async awaitImages() {
    await Promise.all(
      this.textures.map(async (t) => {
        t.bitmap = await fetch(t.url)
          .then((r) => r.blob())
          .then((b) => createImageBitmap(b));
      }),
    );
  }
}

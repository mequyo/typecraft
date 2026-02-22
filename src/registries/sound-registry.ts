export type SoundID = number

export type SoundDefinition = {
  url: string
}

export type Sound = SoundDefinition & {
  ID: SoundID
  buffer?: AudioBuffer
}

export class SoundRegistry {
  private static context: AudioContext
  private static sounds: Sound[] = []

  static register(definition: SoundDefinition): Sound {
    const texture: Sound = {
      ...definition,
      ID: this.sounds.length,
    };
    this.sounds.push(texture);
    return texture;
  }

  static get(sound: SoundID): Sound {
    return this.sounds[sound];
  }

  static getAll(): Sound[] {
    return this.sounds;
  }

  static async awaitSounds(context: AudioContext) {
    await Promise.all(this.sounds.map(async (element) => {
      const response = await fetch(element.url);
      const arraybuffer = await response.arrayBuffer();
      const audiobuffer = await context.decodeAudioData(arraybuffer);
      element.buffer = audiobuffer;
    }));
  }

  static play(soundID: SoundID, volume: number = 1.0) {
    if (!this.context) return;

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();

    gain.gain.value = volume;
    gain.connect(this.context.destination);

    source.buffer = this.sounds[soundID].buffer!;
    source.playbackRate.value = 0.5 + Math.random();
    source.connect(gain);
    source.start();
  }
}
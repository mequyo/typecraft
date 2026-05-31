export class Rand {
  /**
   * Chooses a random element from an array.
   * @param arr The array to choose from.
   * @returns A random element from the given array.
   */
  static array<T>(arr: T[]): T {
    if (arr.length == 0) throw new Error("Array must not be empty.");

    return arr[(Math.random() * arr.length) >> 0];
  }

  /**
   * Returns a random choice from the given choices. The odds have to add up to 1.
   * @param choices An array with the odds ranging from 0.0 - 1.0 and the returned result, if chosen.
   * @returns A random result from the given choices.
   */
  static choice<T>(choices: [number, T][]): T {
    let acc = 0.0;
    let rand = Math.random();

    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i];

      if (rand < acc + choice[0]) return choice[1];

      acc += choice[0];
    }

    throw new Error("Odds have to add up to 1.");
  }

  /**
   * Returns a random floored number (integer) within the given bounds [min; max].
   * @param min The minimum bound.
   * @param max The maximum bound.
   * @returns A random number in the range [min; max].
   */
  static range(min: number, max: number): number {
    return (Math.random() * (max - min) + min) >> 0;
  }
}

export class ArrayUtils {
  static random<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined;
    const index = Math.floor(Math.random() * arr.length);
    return arr[index];
  }

  static sum(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0);
  }

  static avg(arr: number[]): number {
    return ArrayUtils.sum(arr) / this.length;
  }

  static median(arr: number[]): number {
    return arr.sort()[Math.floor(arr.length / 2)];
  }
}

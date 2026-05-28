Math.clamp = function (min: number, value: number, max: number): number {
  return Math.min(Math.max(value, min), max);
};

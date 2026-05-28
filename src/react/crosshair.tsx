export function Crosshair({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <div className="absolute top-1/2 left-1/2">
      <div
        className={`bg-white absolute -translate-1/2`}
        style={{ width: width, height: height }}
      />
      <div
        className={`bg-white absolute -translate-1/2`}
        style={{ width: height, height: width }}
      />
    </div>
  );
}

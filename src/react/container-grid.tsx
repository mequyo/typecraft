type GridProperties = {
  cols: number;
  rows: number;
  scale: number;
  paddingtop?: number;
  children?: React.ReactNode;
} & React.ComponentProps<"div">;
export function ContainerGrid({
  cols,
  rows,
  scale,
  children,
  paddingtop,
  ...props
}: GridProperties) {
  return (
    <div
      className={`grid w-fit h-fit ${props.className}`}
      style={{
        paddingTop: (paddingtop || 0) * scale,
        gap: 2 * scale,
        gridColumn: cols,
        gridRow: rows,
        gridTemplateColumns: `repeat(${cols}, ${16 * scale}px)`,
        gridTemplateRows: `repeat(${rows}, ${16 * scale}px)`,
      }}
    >
      {children}
    </div>
  );
}

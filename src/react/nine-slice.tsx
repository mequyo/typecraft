type Parameters = {
  children?: React.ReactNode;

  borderImage: string;
  slice?: number;
  padding: number;
};

export function NineSlice({
  children,
  borderImage,
  slice = 20,
  padding,
  ...props
}: Parameters & React.ComponentProps<"div">) {
  const scale = 4;

  return (
    <div
      {...props}
      style={{
        borderImage,
        borderImageSlice: `${slice} fill`,
        borderImageWidth: `${slice * scale}px`,
        borderImageRepeat: "repeat",
        borderWidth: padding,
        imageRendering: "pixelated",
      }}
    >
      {children}
    </div>
  );
}

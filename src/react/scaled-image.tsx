import { ReactNode, useEffect, useState } from "react";

type ScaledImageProps = {
  scale: number;
  url: string;
  children?: ReactNode;
} & React.ComponentProps<"div">;
export function ScaledImage({
  scale,
  url,
  children,
  className,
  style,
}: ScaledImageProps) {
  const [size, setSize] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    const image = new Image();
    image.src = url;
    image.onload = () => setSize([image.width, image.height]);
  }, []);

  return (
    <div
      className={`flex flex-col ${className}`}
      style={{
        padding: 0 * scale,
        width: size[0] * scale,
        height: size[1] * scale,
        backgroundImage: `url(${url})`,
        backgroundSize: "100% 100%",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

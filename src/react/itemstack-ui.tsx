export function ItemStackUI({
  amount,
  item,
  ...props
}: { amount?: number; item?: string } & React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      draggable={false}
      className={`relative flex justify-center items-center w-full h-full hover:bg-gray-300/40 cursor-pointer ${props.className}`}
    >
      {item != null && (
        <img
          draggable={false}
          className="w-3/4 h-3/4"
          style={{ filter: "drop-shadow(3px 3px 0px gray)" }}
          src={`./items/${item}.png`}
        />
      )}
      {amount != null && (
        <div
          draggable={false}
          className="absolute bottom-0 text-white"
          style={{ textShadow: "3px 3px 0px gray" }}
        >
          {amount}
        </div>
      )}
    </div>
  );
}

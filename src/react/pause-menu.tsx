import { NineSlice } from "./nine-slice";

export function PauseMenu({ ...props }: {} & React.ComponentProps<"div">) {

  const resume = () => window.dispatchEvent(new CustomEvent("resume"));

  return (
    <div {...props} className="flex flex-col gap-4 pointer-events-auto">
      <NineSlice
        borderImage="url(./ui/button.png)"
        padding={16}
        className="p-2 text-2xl font-bold relative text-center cursor-pointer"
        onClick={resume}
      >
        RESUME
      </NineSlice>

      <NineSlice borderImage="url(./ui/button.png)" padding={16} className="p-2 text-2xl font-bold relative text-center text-gray-500">
        SETTINGS
      </NineSlice>

      <NineSlice borderImage="url(./ui/button.png)" padding={16} className="p-2 text-2xl font-bold relative text-center text-gray-500">
        QUIT
      </NineSlice>
    </div>
  );
}
export type PropBool = { type: "bool"; name: string };
export type PropInt = { type: "int"; name: string; min: number; max: number };
export type PropEnum = { type: "enum"; name: string; values: string[] };
export type BlockProperty = PropBool | PropInt | PropEnum;

export type BlockPropertyNames = "powered" | "open" | "layers" | "orientation";

export const BlockProperties: Record<BlockPropertyNames, BlockProperty> = {
  // Boolean
  powered: { type: "bool", name: "powered" },
  open: { type: "bool", name: "open" },
  // Integer
  orientation: { type: "int", name: "orientation", min: 0, max: 23 },
  layers: { type: "int", name: "layers", min: 0, max: 7 },
};

export type PropBool = { type: "bool"; name: string; bits: number };
export type PropInt = {
  type: "int";
  name: string;
  bits: number;
  min: number;
  max: number;
};
export type PropEnum = {
  type: "enum";
  name: string;
  bits: number;
  values: string[];
};
export type BlockProperty = PropBool | PropInt | PropEnum;

export type BlockPropertyNames = "powered" | "open" | "layers" | "orientation";

export const BlockProperties: Record<BlockPropertyNames, BlockProperty> = {
  // Boolean
  powered: { type: "bool", name: "powered", bits: 1 },
  open: { type: "bool", name: "open", bits: 1 },
  // Integer
  orientation: { type: "int", name: "orientation", min: 0, max: 23, bits: 5 },
  layers: { type: "int", name: "layers", min: 0, max: 7, bits: 3 },
};

import {
  BlockProperties,
  BlockProperty,
  BlockPropertyNames,
} from "./block-properties";

export type BlockStateHash = number & { _: "blockstate hash" };
export type BlockID = number & { _: "block ID" };
export type BlockStateData = {
  blockID: BlockID;
  hash: BlockStateHash;
  properties: Record<BlockPropertyNames, boolean | number>;
};

export class BlockState {
  static encode(
    properties: Record<BlockPropertyNames, boolean | number>,
  ): BlockStateHash {
    const keys = Object.keys(properties) as BlockPropertyNames[];
    let hash = 0;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const property = properties[key] ?? 0;

      hash |= +property << BlockProperties[key].bits;
      hash |= 0; // Constrain to 32bit integer
    }

    return hash as BlockStateHash;
  }

  // Returns the cartesian product of the given properties
  static getAllCombinations(
    properties: BlockProperty[],
  ): Record<BlockPropertyNames, boolean | number>[] {
    const combinations: Record<BlockPropertyNames, boolean | number>[] = [];

    function recurse(
      index: number,
      current: Record<BlockPropertyNames, boolean | number>,
    ) {
      if (index === properties.length) {
        combinations.push({ ...current });
        return;
      }

      const prop = properties[index];
      const values = BlockState.getPropertyValues(prop);

      for (let i = 0; i < values.length; i++) {
        current[prop.name as BlockPropertyNames] = values[i];
        recurse(index + 1, current);
      }
    }

    recurse(0, {} as Record<BlockPropertyNames, boolean | number>);
    return combinations;
  }

  static getPropertyValues(prop: BlockProperty): boolean[] | number[] {
    switch (prop.type) {
      case "bool":
        return [false, true];
      case "int":
        return Array.from({ length: prop.max - prop.min + 1 }).map(
          (_, i) => i + prop.min,
        );
      case "enum":
        throw new Error("Not implemented yet");
    }
  }
}

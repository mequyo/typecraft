import { MeshID } from "../mesh";
import { Block } from "./block-registry";

export type ItemID = number;
export type URL = string;

export type ItemDefinition = {
  name: string;
  stacksize: number;
  source: Block | URL; // If this is provided, the item will use the block mesh as its own mesh
};

export type Item = ItemDefinition & {
  ID: ItemID;
  mesh: MeshID;
};

export class ItemRegistry {
  private static items: Item[] = [];

  static register(definition: ItemDefinition): Item {
    const item: Item = { ...definition, ID: this.items.length,  };
    this.items.push(item);
    return item;
  }

  static get(texture: ItemID): Item {
    return this.items[texture];
  }

  static getAll(): Item[] {
    return this.items;
  }
}

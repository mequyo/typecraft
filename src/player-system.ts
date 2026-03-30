import { vec3 } from "wgpu-matrix";
import { Player } from "./player";
import { World } from "./world";
import { dda, vec3ToLocalChunk } from "./lib";
import { CHUNK_SIZE, PLAYER_REACH } from "./constants";
import { AIR } from "./registries/blocks";
import { BlockStateRegistry } from "./registries/blockstate-registry";



export class PlayerSystem {
  static updateLookat(player: Player, world: World) {   // TODO some blocks arent full blocks so one should take the uvs into considerations
    player.lookat = null;
    const positions = dda(player.eye, player.direction, PLAYER_REACH); // TODO move dda to a RaycastSystem

    for (const hit of positions) {
      const { pos, face } = hit;
      const offset = vec3.floor(vec3.divScalar(pos, CHUNK_SIZE)); // chunk location
      const chunk = world.getChunk(offset);

      if (!chunk) continue;

      const local = vec3ToLocalChunk(pos); // TODO replace with addScalar
      const blockstate = chunk.get(local[0], local[1], local[2]);

      if (BlockStateRegistry.decode(blockstate).block == AIR.ID) continue;

      player.lookat = pos;
      player.placeoffset = face;
      break;
    }
  }
}
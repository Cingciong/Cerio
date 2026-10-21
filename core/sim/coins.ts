import {TILES} from "../config/config.ts"
import type { GameState } from "./state.ts"
import {Tile, toTile} from "../world/tiles.ts"

interface TileInfo{
    contents?: string;
    becomes?: string;
    collect?: string;
}

const INFO: Record<number, TileInfo> = {};
for (const t of Object.values(TILES)) INFO[(t as any).id] = t as TileInfo;

const MULTI_COIN_HITS = 10;

function index(state: GameState, tx: number, ty: number):
number{
    const {map} = state;
    return tx < 0 || ty < 0 || tx >= map.width || ty >= map.height ? -1 : ty * map.width + tx;
}

export function collectCoins(state: GameState): void{
    const {player, map} = state;
    for(let ty = toTile(player.y); ty <= toTile(player.bottom -1); ty++)
    {
        for(let tx = toTile(player.x); tx <= toTile(player.right - 1); tx++)
        {
            const i = index(state, tx, ty);
            if( i >= 0 && INFO[map.tiles[i]]?.collect === "coin")
            {
                map.tiles[i] = Tile.air;
                state.coins++;
            }
        }
    }
}

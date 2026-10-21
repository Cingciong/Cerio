import {CONFIG} from "./config.ts";
import { TILE_SUB } from "./constants.ts";
import type { GameState } from "./state.ts";

export interface RedRing{
    x: number;
    y: number;
    coins: {x: number; y: number}[];
    phase: "waiting" | "active" | "done";
    timer: number;
    collected: boolean[];
}

const TIME = CONFIG.redCoins.timeFrames;

function touches( state: GameState, x: number, y: number, w: number, h: number): boolean
{
    const p = state.player;
    return p.x < x + w && x< p.right && p.y < y + h && y< p.bottom;
}

export function updateRedCoins(state: GameState): void
{
    for(const ring of state.redRings)
    {
        if(ring.phase === "waiting" && touches(state, ring.x, ring.y, TILE_SUB, 2*TILE_SUB))
        {
            ring.phase = "active";
            ring.timer = TIME;
        }

        if(ring.phase !== "active") continue;

        ring.coins.forEach((c, i) =>{
        if(!ring.collected[i] && touches(state, c.x, c.y, TILE_SUB, TILE_SUB))
            ring.collected[i] = true;
        });

        if(ring.collected.every(Boolean)){
            ring.phase = "done";
            state.redRingsCleared++;
        }
        else if(--ring.timer <= 0){
            ring.phase = "done";
        }
    }
}
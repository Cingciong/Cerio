from __future__ import annotations

import torch
import torch.nn.functional as F

from . import layout as L
from .layout import DEFAULT_ARCH, Arch


def unpack(pop: torch.Tensor, arch: Arch = DEFAULT_ARCH) -> dict[str, torch.Tensor]:
    P, offsets, sizes = pop.shape[0], arch.offsets, arch.sizes
    return {n: pop[:, offsets[n]:offsets[n] + sizes[n]].reshape(P, *shape) for n, shape in arch.spec}


def init_population(P: int, device: str, generator: torch.Generator, arch: Arch = DEFAULT_ARCH) -> torch.Tensor:
    pop = torch.zeros(P, arch.dim, device=device)
    offsets, sizes, fan_in = arch.offsets, arch.sizes, arch.fan_in
    for name, _ in arch.spec:
        if name in ("te", "ee"):
            std = 0.5
        elif name in fan_in:
            std = (2.0 / fan_in[name]) ** 0.5
        else:
            continue
        pop[:, offsets[name]:offsets[name] + sizes[name]] = torch.randn(P, sizes[name], device=device, generator=generator) * std
    pop[:, offsets["do"] + L.BUTTONS.index("right")] = 1.0
    return pop


class Obs:
    def __init__(self, rec, device: str):
        t = lambda a, dt=None: torch.from_numpy(a).to(device, non_blocking=True) if dt is None else torch.from_numpy(a).to(device).to(dt)
        self.tiles = t(rec["tiles"].copy(), torch.long)
        self.ents = t(rec["ents"].copy(), torch.long)
        self.etype = t(rec["etype"].copy(), torch.long)
        self.sc = t(rec["sc"].copy())
        self.en = t(rec["en"].copy())


def conv(x: torch.Tensor, weight: torch.Tensor, bias: torch.Tensor) -> torch.Tensor:
    # [P, in, H, W] -> [P, out, H/2, W/2]
    P, out_ch, in_ch = weight.shape[:3]
    y = F.conv2d(x.reshape(1, P * in_ch, *x.shape[2:]), weight.reshape(P * out_ch, in_ch, 3, 3), bias.reshape(-1),
                 stride=2, padding=1, groups=P)
    return torch.relu(y.reshape(P, out_ch, *y.shape[2:]))


def linear(x: torch.Tensor, weight: torch.Tensor, bias: torch.Tensor) -> torch.Tensor:
    # [P, in] -> [P, out]
    return torch.einsum("pi,pio->po", x, weight) + bias


@torch.no_grad()
def forward(pop: torch.Tensor, obs: Obs, trace: bool = False, arch: Arch = DEFAULT_ARCH):
    w = unpack(pop, arch)
    genome = torch.arange(pop.shape[0], device=pop.device)[:, None, None]

    tiles = w["te"][genome, obs.tiles]  # 15x32 ids -> [P, 15, 32, tile_emb]
    ents = w["ee"][genome, obs.ents]  # 15x32 ids -> [P, 15, 32, ent_emb]
    view = torch.cat([tiles, ents], dim=-1).permute(0, 3, 1, 2)  # [P, tile_emb + ent_emb, 15, 32]

    a1 = conv(view, w["c1"], w["b1"])  # [P, tile_emb + ent_emb, 15, 32] -> [P, conv1, 8, 16]
    a2 = conv(a1, w["c2"], w["b2"])  # [P, conv1, 8, 16] -> [P, conv2, 4, 8]

    enemy_type = w["ee"][genome[:, :, 0], obs.etype]  # 16 enemies -> [P, 16, ent_emb]
    enemy = torch.relu(torch.einsum("pme,pef->pmf", torch.cat([obs.en, enemy_type], -1), w["we"]) + w["be"][:, None, :])  # [P, 16, 5 + ent_emb] -> [P, 16, enemy_hidden]
    enemies = (enemy * (obs.etype > 0).unsqueeze(-1)).amax(1)  # [P, 16, enemy_hidden] -> [P, enemy_hidden]

    x = torch.cat([a2.flatten(1), enemies, obs.sc], 1)  # [P, conv2*32 + enemy_hidden + 15]
    hidden = []
    for i in range(1, len(arch.hidden) + 1):
        x = torch.relu(linear(x, w[f"w{i}"], w[f"d{i}"]))  # [P, previous] -> [P, dense_i]
        hidden.append(x)
    out = linear(x, w["wo"], w["do"])  # [P, last dense] -> [P, 6]
    if not trace:
        return out
    return out, {"conv1": a1, "conv2": a2, "enemies": enemies, "dense1": hidden[0], "dense2": hidden[1], "out": out}


_BITS = None


def to_buttons(logits: torch.Tensor):
    global _BITS
    if _BITS is None or _BITS.device != logits.device:
        _BITS = torch.tensor(L.BUTTON_BITS, device=logits.device, dtype=torch.int32)
    return ((logits > 0).int() * _BITS).sum(1).to(torch.uint8).cpu().numpy()

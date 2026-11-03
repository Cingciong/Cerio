"""Figures for TensorBoard (and PNG files): the network's weights, how they changed, what it sees, population spread."""

from __future__ import annotations

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch

from . import layout as L
from . import net
from .layout import DEFAULT_ARCH, Arch


def _heat(ax, m, title, xlabels=None, ylabels=None, vmax=None):
    m = np.asarray(m, dtype=np.float32)
    v = vmax if vmax is not None else max(float(np.abs(m).max()), 1e-6)
    ax.imshow(m, cmap="coolwarm", vmin=-v, vmax=v, aspect="auto", interpolation="nearest")
    ax.set_title(title, fontsize=9)
    ax.set_xticks(range(len(xlabels)) if xlabels else [])
    if xlabels:
        ax.set_xticklabels(xlabels, fontsize=6, rotation=90)
    ax.set_yticks(range(len(ylabels)) if ylabels else [])
    if ylabels:
        ax.set_yticklabels(ylabels, fontsize=5)


def _parts(vec: torch.Tensor, arch: Arch) -> dict[str, np.ndarray]:
    return {k: v[0].cpu().numpy() for k, v in net.unpack(vec[None], arch).items()}


def _tiled(w: np.ndarray) -> np.ndarray:
    """[filters, channels, 3, 3] -> one image, a 3x3 patch per (filter, channel)."""
    f, c, kh, kw = w.shape
    return w.transpose(0, 2, 1, 3).reshape(f * kh, c * kw)


def weights_figure(best: torch.Tensor, prev: torch.Tensor | None, gen: int, score: float, arch: Arch = DEFAULT_ARCH):
    p = _parts(best, arch)
    fig = plt.figure(figsize=(17, 11), constrained_layout=True)
    gs = fig.add_gridspec(3, 4)
    tile_labels = [L.TILE_NAMES.get(i, "") for i in range(L.SLOTS)]
    ent_labels = [L.ENTITY_NAMES.get(i, "") if i else "none" for i in range(L.SLOTS)]
    a = arch
    _heat(fig.add_subplot(gs[0, 0]), p["te"], "tile embedding", [f"d{i}" for i in range(a.tile_emb)], tile_labels)
    _heat(fig.add_subplot(gs[0, 1]), p["ee"], "entity embedding", [f"d{i}" for i in range(a.ent_emb)], ent_labels)
    _heat(fig.add_subplot(gs[0, 2]), _tiled(p["c1"]), f"conv1 filters (rows) x input channel (t0-{a.tile_emb - 1}, e0-{a.ent_emb - 1})")
    _heat(fig.add_subplot(gs[0, 3]), _tiled(p["c2"]), "conv2 filters x conv1 channel")
    ax = fig.add_subplot(gs[1, 0:2])
    _heat(ax, p["w1"].T, f"dense1: {a.dense1} neurons x [conv {a.flat} | enemies {a.enemy_hidden} | scalars {L.N_SCALARS}]")
    ax.axvline(a.flat - 0.5, color="k", lw=0.6)
    ax.axvline(a.flat + a.enemy_hidden - 0.5, color="k", lw=0.6)
    _heat(fig.add_subplot(gs[1, 2]), p["w2"].T, f"dense2 ({a.dense2} x {a.dense1})")
    _heat(fig.add_subplot(gs[1, 3]), p["wo"], f"output ({a.dense2} x buttons)", L.BUTTONS)
    _heat(fig.add_subplot(gs[2, 0]), p["we"], f"enemy encoder ({p['we'].shape[0]} x {a.enemy_hidden})")
    _heat(fig.add_subplot(gs[2, 1]), p["w1"][a.flat + a.enemy_hidden:].T, "scalars -> dense1", L.SCALAR_NAMES)

    ax = fig.add_subplot(gs[2, 2])
    names = [n for n, _ in a.spec if not n.startswith(("b", "d"))]
    if prev is not None:
        q = _parts(prev, arch)
        delta = [float(np.abs(p[n] - q[n]).mean()) for n in names]
        ax.bar(names, delta, color="tab:orange")
        ax.set_title("mean |change| since previous best", fontsize=9)
    else:
        ax.axis("off")
    ax.tick_params(labelsize=7)
    ax = fig.add_subplot(gs[2, 3])
    for n in names:
        ax.hist(p[n].ravel(), bins=40, histtype="step", label=n, density=True)
    ax.set_title("weight distribution per tensor", fontsize=9)
    ax.legend(fontsize=5, ncol=2)
    ax.tick_params(labelsize=7)
    fig.suptitle(f"best network, generation {gen}, score {score:.0f}")
    return fig


def activation_figure(vec: torch.Tensor, rec, gen: int, arch: Arch = DEFAULT_ARCH):
    """What the best genome sees at one moment and how each layer reacts."""
    obs = net.Obs(rec, vec.device.type)
    out, act = net.forward(vec[None], obs, trace=True, arch=arch)
    fig = plt.figure(figsize=(17, 9), constrained_layout=True)
    gs = fig.add_gridspec(3, 6)

    ax = fig.add_subplot(gs[0:2, 0:3])
    tiles = rec["tiles"][0].astype(int)
    ax.imshow(tiles, cmap="tab20", interpolation="nearest", vmin=0, vmax=31)
    ys, xs = np.nonzero(rec["ents"][0])
    for y, x in zip(ys, xs):
        ax.text(x, y, L.ENTITY_NAMES.get(int(rec["ents"][0][y, x]), "?")[:3], color="red", fontsize=7, ha="center", va="center")
    ax.axvline(8, color="k", lw=0.8)  # the player's column (8 tiles of view behind him)
    ax.set_title("input: tile ids (colour), entities (red); the player is on the black line", fontsize=9)

    c1 =act["conv1"][0].cpu().numpy()
    c2 = act["conv2"][0].cpu().numpy()
    ax = fig.add_subplot(gs[0, 3:6])
    ax.imshow(np.concatenate(list(c1[:4]), 1), cmap="viridis", aspect="auto")
    ax.set_title("conv1 maps 0-3 (stride 2)", fontsize=9)
    ax = fig.add_subplot(gs[1, 3:6])
    ax.imshow(np.concatenate(list(c2), 1), cmap="viridis", aspect="auto")
    ax.set_title("conv2 maps 0-7", fontsize=9)

    ax = fig.add_subplot(gs[2, 0:2])
    ax.bar(range(arch.dense1), act["dense1"][0].cpu().numpy())
    ax.set_title("dense1 activations", fontsize=9)
    ax = fig.add_subplot(gs[2, 2:4])
    ax.bar(range(arch.dense2), act["dense2"][0].cpu().numpy())
    ax.set_title("dense2 activations", fontsize=9)
    ax = fig.add_subplot(gs[2, 4:6])
    o = act["out"][0].cpu().numpy()
    ax.bar(L.BUTTONS, o, color=["tab:green" if v > 0 else "tab:gray" for v in o])
    ax.set_title("output (green = pressed)", fontsize=9)
    fig.suptitle(f"best surviving network seeing one frame (decision 30), generation {gen}")
    return fig


def population_figure(pop: torch.Tensor, scores: np.ndarray, gen: int):
    """Population in weight space (first two principal components), coloured by score."""
    x = pop - pop.mean(0)
    _, _, v = torch.pca_lowrank(x, q=2, center=False)
    xy = (x @ v[:, :2]).cpu().numpy()
    fig, ax = plt.subplots(figsize=(6, 5), constrained_layout=True)
    sc = ax.scatter(xy[:, 0], xy[:, 1], c=scores, cmap="viridis", s=14)
    best = int(np.argmax(scores))
    ax.scatter(xy[best, 0], xy[best, 1], marker="*", s=180, c="red")
    fig.colorbar(sc, ax=ax, label="score")
    ax.set_title(f"population in weight space (PCA), generation {gen}", fontsize=9)
    return fig


def log_histograms(writer, pop: torch.Tensor, best: torch.Tensor, gen: int, arch: Arch = DEFAULT_ARCH) -> None:
    offsets, sizes = arch.offsets, arch.sizes
    for name, shape in arch.spec:
        sl = slice(offsets[name], offsets[name] + sizes[name])
        writer.add_histogram(f"weights_best/{name}", best[sl].cpu().numpy(), gen)
        writer.add_histogram(f"weights_population/{name}", pop[:, sl].reshape(-1).cpu().numpy(), gen)

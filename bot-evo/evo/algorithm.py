"""Genetic algorithm on the GPU: elitism, tournament selection, uniform crossover, gaussian mutation.
Parameters come from the run config (evolution section) and may change between generations."""

from __future__ import annotations

import torch


class GA:
    def __init__(self, device: str, seed: int, cfg: dict):
        self.device = device
        self.gen = torch.Generator(device=device)
        self.gen.manual_seed(seed)
        self.best = None  # best smoothed elite score so far
        self.ema = None
        self.stale = 0
        self.base_sigma = None
        self.sigma = cfg["sigma"]
        self.configure(cfg)

    def configure(self, c: dict) -> None:
        self.c = c
        if self.base_sigma is not None and c["sigma"] != self.base_sigma:
            self.sigma = c["sigma"]  # edited by hand
        self.base_sigma = c["sigma"]

    def n_elite(self, P: int) -> int:
        return max(1, int(P * self.c["elite"]))

    def _n_parents(self, P: int) -> int:
        return max(2, int(P * self.c["parents"]))

    def reset_progress(self) -> None:
        self.best = self.ema = None
        self.stale = 0

    def adapt_sigma(self, elite_mean: float) -> None:
        """Shrink the mutation every generation; widen it when the smoothed elite score has stalled for 20 generations.
        (Levels change every generation, so single scores are noisy: a moving average is compared, not the best score.)"""
        self.ema = elite_mean if self.ema is None else 0.8 * self.ema + 0.2 * elite_mean
        if self.best is None or self.ema > self.best + 0.01 * abs(self.best):
            self.best, self.stale = self.ema, 0
        else:
            self.stale += 1
        self.sigma = max(0.01, self.sigma * self.c["sigmaDecay"])
        if self.stale >= 20:
            self.sigma = min(3 * self.base_sigma, self.sigma * self.c["staleBoost"])
            self.stale = 0

    def evolve(self, pop: torch.Tensor, scores: torch.Tensor) -> torch.Tensor:
        P, D = pop.shape
        n_el, n_par = self.n_elite(P), self._n_parents(P)
        ranked = pop[torch.argsort(scores, descending=True)]
        n = P - n_el

        def pick():  # tournament over ranks 0..n_par-1, rank 0 = best
            r = torch.randint(0, n_par, (n, int(self.c["tournament"])), device=self.device, generator=self.gen)
            return r.min(1).values

        a, b = ranked[pick()], ranked[pick()]
        mix = torch.rand(n, 1, device=self.device, generator=self.gen) < self.c["crossover"]
        mask = torch.rand(n, D, device=self.device, generator=self.gen) < 0.5
        child = torch.where(mix & mask, b, a)
        child = child + torch.randn(child.shape, device=self.device, generator=self.gen) * self.sigma
        return torch.cat([ranked[:n_el], child])

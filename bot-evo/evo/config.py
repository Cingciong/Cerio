"""Run configuration. Schema and defaults: bot-evo/defaults.json; values of one run: runs/<run>/config.json.

Everything except the keys marked "hot": false can be edited while the run is training (read again every generation).
"""

from __future__ import annotations

import json
from pathlib import Path

from .layout import ROOT

DEFAULTS = json.loads((ROOT / "bot-evo" / "defaults.json").read_text(encoding="utf8"))
GROUPS = list(DEFAULTS)


def coerce(default, raw):
    if isinstance(default, bool):
        return bool(raw)
    if isinstance(default, int):
        return int(float(raw))
    if isinstance(default, float):
        return float(raw)
    return str(raw)


def defaults() -> dict:
    return {g: {k: v["value"] for k, v in DEFAULTS[g].items()} for g in GROUPS}


def load(run_dir: Path) -> dict:
    cfg = defaults()
    path = run_dir / "config.json"
    if path.exists():
        saved = json.loads(path.read_text(encoding="utf8"))
        for g in GROUPS:
            for k, v in saved.get(g, {}).items():
                if k in cfg[g]:
                    cfg[g][k] = coerce(cfg[g][k], v)
    return cfg


def save(run_dir: Path, cfg: dict) -> None:
    (run_dir / "config.json").write_text(json.dumps(cfg, indent=2), encoding="utf8")


def stages(cfg: dict) -> list[int]:
    parsed = [int(x) for x in str(cfg["evolution"]["stages"]).replace(" ", "").split(",") if x.isdigit()]
    return parsed or [60]

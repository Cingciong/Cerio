// Panel to the right of the game (dev server only), plain HTML elements, three tabs:
//   GRAJ     start a level: random by seed, a map from the JSON files, or a level saved in levels/generated/
//   BOTY     saved bots: when trained, how many generations; watch them train or let one play a level you pick
//   TRENING  start / stop / continue training, edit evolution, score and network layer sizes
// The training form is generated from bot-evo/defaults.json (label, description, range of each setting). API: bot-evo/vitePlugin.ts.

import type { Replay } from "./replay.ts";

export type LaunchSpec =
  | { kind: "human" }
  | { kind: "random"; seed: number; length: number; type: string }
  | { kind: "segment"; name: string }
  | { kind: "generated"; name: string }
  | { kind: "watch"; run: string; gen?: string }
  | { kind: "replay"; data: Replay; title: string };

export interface GameApi {
  types: string[];
  segments: { name: string; folder: string }[];
  generated: string[];
  launch(spec: LaunchSpec): string | null;
  current(): { label: string; spec: LaunchSpec };
}

interface Field {
  value: number | string;
  min?: number;
  max?: number;
  step?: number;
  hot?: boolean;
  type?: string;
  label: string;
  desc: string;
}
type Schema = Record<string, Record<string, Field>>;
type Config = Record<string, Record<string, number | string>>;
type Status = { active: string | null; gen: number | null };

interface Model {
  name: string;
  created: string | null;
  updated: string | null;
  generations: number;
  best: number | null;
  length: number | null;
  hasVal: boolean;
  running: boolean;
  dim?: number;
}

interface Ranking {
  time: number;
  length: number;
  levels: number;
  bots: { run: string; genome: "val" | "gen"; score: number; progress: number; wins: number; levels: number }[];
}

const BASIC = ["pop", "levels", "gens"];
const PRESETS: { name: string; hint: string; values: Record<string, number> }[] = [
  { name: "Szybki test", hint: "100 botów, 30 generacji", values: { pop: 100, levels: 2, gens: 30 } },
  { name: "Standard", hint: "200 botów, 500 generacji", values: { pop: 200, levels: 3, gens: 500 } },
  { name: "Duży", hint: "1000 botów, 6 procesów, 1000 generacji", values: { pop: 1000, levels: 3, gens: 1000, workers: 6 } },
];
const PANEL_KEY = "cerio.botPanel";
const VALIDATION_SEED = 900_000; // the 20 fixed levels bot-evo validates on: 900000..900019

let api: GameApi;
let panel: HTMLElement;
let body: HTMLElement;
let tabs: HTMLElement;
let wrap: HTMLElement; // scrolls inside the panel, fixed height
let tab: "play" | "bots" | "train" = "play";
let schema: Schema | null = null;
let selected = ""; // model chosen in the training tab; "" = new
let timer = 0;
let busy = false; // a bot is being computed: do not redraw the tab
let botModel = ""; // the model chosen in the BOTY tab
const inputs = new Map<string, HTMLInputElement>();

/** Level a bot is going to play (BOTY tab). Kept here so the periodic redraw does not reset the choice. */
const pick = { mode: "random", seed: 1, length: 120, type: "normal", map: "", saved: "", val: 0 };

type Kid = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  Object.assign(el, props);
  el.append(...(kids.filter((k) => k !== null && k !== undefined && k !== false) as (Node | string)[]));
  return el;
}

async function call<T>(path: string, payload?: unknown): Promise<T> {
  const r = await fetch(`/__bot/${path}`, payload === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? r.statusText);
  return data as T;
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-");
const fmtNum = (n: number | null | undefined) => (n == null || n < -1e8 ? "-" : Math.round(n).toLocaleString("pl-PL"));

function button(label: string, onclick: () => void): HTMLButtonElement {
  const b = h("button", { textContent: label });
  b.onclick = () => {
    b.blur(); // Space would press it again
    onclick();
  };
  return b;
}

const box = (title: string, ...kids: Kid[]) => h("fieldset", {}, h("legend", {}, title), ...kids);
const line = (...kids: Kid[]) => h("p", {}, ...kids);
const lab = (text: string, input: HTMLElement) => h("label", {}, `${text} `, input, " ");
const numberInput = (value: number, min: number, max: number, step = 1) => h("input", { type: "number", value: String(value), min: String(min), max: String(max), step: String(step) });
const options = (values: string[], selectedValue: string) => values.map((v) => h("option", { value: v, selected: v === selectedValue }, v));

// ---------------------------------------------------------------- GRAJ

function renderPlay(): void {
  const now = api.current();
  const spec = now.spec.kind === "random" ? now.spec : { seed: 1, length: 200, type: "normal" };
  const msg = h("p", {});
  const report = (err: string | null) => { msg.textContent = err ?? ""; };

  const seed = numberInput(spec.seed, 0, 999_999_999);
  const length = numberInput(spec.length, 30, 600, 10);
  const type = h("select", {}, ...options(api.types, spec.type));
  const go = () => report(api.launch({ kind: "random", seed: Number(seed.value), length: Number(length.value), type: type.value }));
  seed.onchange = length.onchange = type.onchange = go; // Enter or leaving the field starts the level

  const level = box("level",
    line(lab("level:", seed), lab("blocks:", length), lab("type:", type)),
    line(button("Zapisz poziom", async () => {
      const name = window.prompt("Nazwa poziomu (litery, cyfry, - i _):", `level-${seed.value}`)?.trim();
      if (!name) return;
      try {
        const r = await call<{ name: string }>("save-level", { name, seed: Number(seed.value), length: Number(length.value), type: type.value });
        msg.textContent = `zapisano: ${r.name}`;
      } catch (e) {
        msg.textContent = `BŁĄD: ${(e as Error).message}`;
      }
    })));

  const filter = h("input", { type: "search", placeholder: "szukaj" });
  const list = h("select", { size: 10 });
  const fill = () => {
    const q = filter.value.trim().toLowerCase();
    list.replaceChildren();
    for (const folder of [...new Set(api.segments.map((s) => s.folder))]) {
      const items = api.segments.filter((s) => s.folder === folder && s.name.toLowerCase().includes(q));
      if (items.length) list.append(h("optgroup", { label: `${folder} (${items.length})` }, ...items.map((s) => h("option", { value: s.name }, s.name))));
    }
    if (list.options.length) list.selectedIndex = 0;
  };
  filter.oninput = fill;
  fill();
  const launchMap = () => list.value && report(api.launch({ kind: "segment", name: list.value }));
  list.ondblclick = launchMap;
  const maps = box("segmenty", line(filter), line(list), line(button("uruchom segment", launchMap)));

  const saved = h("select", { size: 8 }, ...api.generated.map((n) => h("option", { value: n }, n)));
  if (saved.options.length) saved.selectedIndex = 0;
  const launchSaved = () => saved.value && report(api.launch({ kind: "generated", name: saved.value }));
  saved.ondblclick = launchSaved;
  const generated = box("poziomy", api.generated.length ? line(saved) : line("brak"), api.generated.length > 0 && line(button("uruchom poziom", launchSaved)));

  body.replaceChildren(line(h("b", {}, now.label)), level, maps, generated, msg);
}

// ---------------------------------------------------------------- BOTY

/** Which level the bot plays, from the choice in the picker. */
function pickedLevel(): { level: Record<string, unknown>; text: string } | string {
  const base = { length: pick.length, type: pick.type };
  if (pick.mode === "random") {
    const seed = Math.floor(Math.random() * 1e6);
    return { level: { seed, ...base }, text: `level: ${seed}` };
  }
  if (pick.mode === "seed") return { level: { seed: pick.seed, ...base }, text: `level: ${pick.seed}` };
  if (pick.mode === "val") return { level: { seed: VALIDATION_SEED + pick.val, ...base }, text: `validation: ${pick.val}` };
  if (pick.mode === "map") return pick.map ? { level: { segment: pick.map }, text: `segment: ${pick.map}` } : "wybierz segment";
  return pick.saved ? { level: { segment: `generated/${pick.saved}` }, text: `poziom: ${pick.saved}` } : "brak zapisanych poziomów";
}

async function playOn(run: string, genome: "val" | "gen" | undefined, status: HTMLElement): Promise<void> {
  const chosen = pickedLevel();
  if (typeof chosen === "string") { status.textContent = chosen; return; }
  busy = true;
  status.textContent = "liczenie…";
  try {
    const data = await call<Replay>("play", { run, genome, ...chosen.level });
    const err = api.launch({ kind: "replay", data, title: `bot: ${run} | ${chosen.text}` });
    status.textContent = err ?? "";
  } catch (e) {
    status.textContent = `BŁĄD: ${(e as Error).message}`;
  } finally {
    busy = false;
  }
}

function levelPicker(): HTMLElement {
  const radio = (mode: string, ...kids: Kid[]) => {
    const r = h("input", { type: "radio", name: "pick-mode", checked: pick.mode === mode });
    r.onchange = () => (pick.mode = mode);
    return h("li", {}, h("label", {}, r, " ", ...kids));
  };
  const onNum = (el: HTMLInputElement, key: "seed" | "length" | "val") => { el.oninput = () => (pick[key] = Number(el.value)); return el; };
  const seed = onNum(numberInput(pick.seed, 0, 999_999_999), "seed");
  const length = onNum(numberInput(pick.length, 30, 600, 10), "length");
  const val = onNum(numberInput(pick.val, 0, 19), "val");
  const type = h("select", {}, ...options(api.types, pick.type));
  type.onchange = () => (pick.type = type.value);
  const map = h("select", {}, ...api.segments.map((s) => h("option", { value: s.name, selected: s.name === pick.map }, `${s.folder}/${s.name}`)));
  pick.map ||= map.value;
  map.onchange = () => (pick.map = map.value);
  const saved = h("select", {}, ...options(api.generated, pick.saved));
  pick.saved ||= saved.value;
  saved.onchange = () => (pick.saved = saved.value);

  return box("poziom dla bota",
    h("ol", {},
      radio("random", "random"),
      radio("seed", "level: ", seed),
      radio("val", "validation (0-19): ", val),
      radio("map", "segment: ", map),
      radio("saved", "poziom: ", api.generated.length ? saved : "brak")),
    line(lab("blocks:", length), lab("type:", type)));
}

async function renderBots(): Promise<void> {
  const models = await call<Model[]>("models.json");
  const ranking = await call<Ranking>("ranking.json").catch(() => null);
  if (!models.length) { body.replaceChildren(line("brak botów")); return; }
  const m = models.find((x) => x.name === botModel) ?? models[0];
  botModel = m.name;

  const choose = h("select", {}, ...models.map((x) => h("option", { value: x.name, selected: x.name === m.name }, x.name)));
  choose.onchange = () => { botModel = choose.value; void renderBots(); };
  const out = h("b", {}, "");
  const info = h("details", {}, h("summary", {}, "opis"),
    line(`utworzony ${fmtDate(m.created)} · trenowany ${fmtDate(m.updated)}`),
    line(`${m.generations} pokoleń · wynik ${fmtNum(m.best)} · ${m.length ?? "-"} kafli · ${m.dim ? m.dim.toLocaleString("pl-PL") : "-"} wag`));

  const recount = () => void (async () => {
    busy = true;
    out.textContent = "liczenie rankingu…";
    try {
      await call("rank", {});
      busy = false;
      await renderBots();
    } catch (e) {
      out.textContent = `BŁĄD: ${(e as Error).message}`;
    } finally {
      busy = false;
    }
  })();
  const rank = h("details", {}, h("summary", {}, "ranking"),
    ranking ? h("ol", {}, ...ranking.bots.map((b) => h("li", {}, `${b.run}: ${fmtNum(b.score)} pkt · ${Math.round(b.progress * 100)}% · wygrane ${b.wins}/${b.levels}`))) : line("brak"),
    line(button("przelicz", recount)));

  const net = netFromConfig(await call<Config>(`${m.name}/config.json`).catch(() => null));
  const genome = ranking?.bots.find((b) => b.run === m.name)?.genome;
  body.replaceChildren(line(h("b", {}, api.current().label)), levelPicker(),
    box("model", line(choose), info, netSvg(net), line(`wag: ${paramCount(net).toLocaleString("pl-PL")}`), line(button("GRAJ", () => void playOn(m.name, genome, out)), " ", out)), rank);
}

// ---------------------------------------------------------------- TRENING

const num = (id: string): number => Number(inputs.get(id)?.value ?? 0);

interface Net { tileEmb: number; entEmb: number; enemyHidden: number; conv1: number; conv2: number; dense: number[] }

const netOf = (get: (key: string) => number): Net => ({
  tileEmb: get("tileEmb"), entEmb: get("entEmb"), enemyHidden: get("enemyHidden"), conv1: get("conv1"), conv2: get("conv2"),
  dense: ["dense1", "dense2", "dense3", "dense4"].map(get).filter((n) => n > 0),
});
const netFromForm = (): Net => netOf((k) => num(`network.${k}`));
const netFromConfig = (c: Config | null): Net => netOf((k) => Number(c?.network?.[k] ?? (k === "dense3" || k === "dense4" ? 0 : 1)));

/** Same formula as bot-evo/evo/layout.py (Arch.spec). */
function paramCount(n: Net): number {
  let total = 32 * n.tileEmb + 32 * n.entEmb + (5 + n.entEmb) * n.enemyHidden + n.enemyHidden
    + n.conv1 * (n.tileEmb + n.entEmb) * 9 + n.conv1 + n.conv2 * n.conv1 * 9 + n.conv2;
  let prev = n.conv2 * 32 + n.enemyHidden + 15;
  for (const d of n.dense) { total += prev * d + d; prev = d; }
  return total + prev * 6 + 6;
}

/** The network drawn as columns of neurons (a column shows at most 14 of them; the number under it is the real size). */
function netSvg(n: Net): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const W = 720, H = 210, top = 38, bottom = 158;
  const cols: { name: string; count: number; label?: string[] }[] = [
    { name: "widok 32x15", count: 480 }, { name: "splot 1", count: n.conv1 }, { name: "splot 2", count: n.conv2 },
    { name: "+ wrogowie + gracz", count: n.conv2 * 32 + n.enemyHidden + 15 },
    ...n.dense.map((d, i) => ({ name: `warstwa ${i + 1}`, count: d })),
    { name: "przyciski", count: 6, label: ["lewo", "prawo", "skok", "bieg", "dół", "atak"] },
  ];
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", "100%");
  const el = (tag: string, attrs: Record<string, string | number>, text?: string) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (text !== undefined) e.textContent = text;
    svg.append(e);
  };
  const xs = cols.map((_, i) => 46 + (i * (W - 150)) / (cols.length - 1));
  const dots = cols.map((c) => {
    const shown = Math.min(c.count, 14, Math.round(3 + 1.6 * Math.log2(Math.max(c.count, 1))));
    return Array.from({ length: shown }, (_, k) => (shown === 1 ? (top + bottom) / 2 : top + (k * (bottom - top)) / (shown - 1)));
  });
  for (let i = 0; i < cols.length - 1; i++) {
    for (const y1 of dots[i]) for (const y2 of dots[i + 1]) el("line", { x1: xs[i], y1, x2: xs[i + 1], y2, stroke: "currentColor", "stroke-opacity": 0.12 });
  }
  cols.forEach((c, i) => {
    dots[i].forEach((y, k) => {
      el("circle", { cx: xs[i], cy: y, r: 4, fill: "#111", stroke: "currentColor" });
      if (c.label) el("text", { x: xs[i] + 10, y: y + 4, fill: "currentColor", "font-size": 11 }, c.label[k]);
    });
    el("text", { x: xs[i], y: 16, "text-anchor": "middle", fill: "currentColor", "font-size": 11 }, c.name);
    el("text", { x: xs[i], y: H - 14, "text-anchor": "middle", fill: "currentColor", "font-size": 12, "font-weight": "bold" }, String(c.count));
  });
  return svg;
}

/** One numbered list item per setting: name, field, when it applies, then the description below. */
function settingList(group: string, keys: string[], values: Config | null, locked: boolean): HTMLElement {
  return h("ol", {}, ...keys.map((key) => {
    const f = schema![group][key];
    const input = h("input", { type: f.type === "text" ? "text" : "number", value: String(values?.[group]?.[key] ?? f.value) });
    if (f.type !== "text") Object.assign(input, { min: String(f.min ?? ""), max: String(f.max ?? ""), step: String(f.step ?? "any") });
    input.disabled = locked && f.hot === false;
    inputs.set(`${group}.${key}`, input);
    const live = group !== "network" && f.hot !== false;
    return h("li", {}, line(h("b", {}, f.label), " ", input, " ", h("i", {}, live ? "[zmiana na żywo]" : "[tylko przy starcie]")), line(h("small", {}, f.desc)));
  }));
}

function readForm(): Config {
  const out: Config = {};
  for (const [id, input] of inputs) {
    const [group, key] = id.split(".");
    (out[group] ??= {})[key] = schema![group][key].type === "text" ? input.value : Number(input.value);
  }
  return out;
}

const fold = (title: string, open: boolean, ...kids: Kid[]) => h("details", { open }, h("summary", {}, h("b", {}, title)), ...kids);

function tensorboardBox(): HTMLElement {
  const msg = h("span", {});
  const frame = h("div", {});
  const start = async () => {
    msg.textContent = "uruchamianie…";
    try {
      for (let i = 0; i < 45; i++) {
        if ((await call<{ up: boolean }>("tensorboard", {})).up) {
          msg.textContent = "działa";
          frame.replaceChildren(h("iframe", { src: "/tensorboard/", width: "100%", height: "640" }));
          return;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      msg.textContent = "nie wystartował (zobacz bot-evo/runs/tensorboard.log)";
    } catch (e) {
      msg.textContent = `BŁĄD: ${(e as Error).message}`;
    }
  };
  return box("TensorBoard", line(button("uruchom i pokaż", start), " ", h("a", { href: "/tensorboard/", target: "_blank" }, "otwórz w nowej karcie"), " ", msg), frame);
}

async function renderTrain(keepForm = false): Promise<void> {
  schema ??= await call<Schema>("schema.json");
  const [models, status] = await Promise.all([call<Model[]>("models.json"), call<Status>("status.json")]);
  const running = status.active;
  const model = models.find((m) => m.name === selected);
  const locked = selected !== "";

  const msg = h("span", {});
  const send = async (path: string, payload: Record<string, unknown>) => {
    try {
      await call(path, payload);
      msg.textContent = "OK";
    } catch (e) {
      msg.textContent = `BŁĄD: ${(e as Error).message}`;
    }
    setTimeout(() => void renderTrain(true), 400);
  };

  const state = h("p", {}, h("b", {}, running ? `TRENING DZIAŁA: ${running}, generacja ${status.gen ?? "?"}` : "Żaden trening nie działa."), " ", running && button("STOP (po bieżącej generacji)", () => void send("stop", { run: running })));

  const name = h("input", { type: "text", value: `bot-${new Date().toISOString().slice(5, 10).replace("-", "")}`, maxLength: 40 });
  const choose = h("select", {}, h("option", { value: "" }, "NOWY MODEL"), ...models.map((m) => h("option", { value: m.name, selected: m.name === selected }, `${m.name} | ${m.generations} pok. | ${fmtDate(m.created)}`)));
  choose.onchange = () => { selected = choose.value; inputs.clear(); void renderTrain(); };
  const step1 = box("Krok 1: który model?",
    line(lab("Model", choose)),
    model ? line(`Kontynuujesz „${model.name}”: ${model.generations} pokoleń, utworzony ${fmtDate(model.created)}, najlepszy wynik ${fmtNum(model.best)}. Pól [tylko przy starcie] nie da się zmienić.`)
      : line(lab("Nazwa nowego modelu", name), "(litery, cyfry, - i _)"));

  const log = h("pre", {}, "(brak logu)");
  const logRun = running ?? selected;
  if (logRun) void call<{ lines: string[] }>(`log/${logRun}`).then((r) => { log.textContent = r.lines.join("\n") || "(brak logu)"; log.scrollTop = log.scrollHeight; });

  const form = h("div", {});
  if (keepForm && inputs.size) {
    form.append(...new Set([...inputs.values()].map((i) => i.closest("details")!)));
  } else {
    inputs.clear();
    const values = locked ? await call<Config>(`${selected}/config.json`) : null;
    const advanced = Object.keys(schema.evolution).filter((k) => !BASIC.includes(k));
    const presets = line("Szablony: ", ...PRESETS.flatMap((p) => [button(p.name, () => {
      for (const [k, v] of Object.entries(p.values)) { const i = inputs.get(`evolution.${k}`); if (i && !i.disabled) i.value = String(v); }
    }), ` (${p.hint}) `]));
    const diagram = h("div", {});
    const refresh = () => {
      const n = netFromForm();
      const count = paramCount(n);
      diagram.replaceChildren(netSvg(n), line(`wag: ${count.toLocaleString("pl-PL")}${count > 100_000 ? " (duża sieć: wolniejsze generacje, trudniej ją ewoluować)" : count < 3000 ? " (bardzo mała sieć)" : ""}`));
    };
    form.append(
      fold("PODSTAWOWE (ile botów, poziomów, generacji)", true, presets, settingList("evolution", BASIC, values, locked)),
      fold("EWOLUCJA - zaawansowane (mutacje, selekcja, etapy)", false, settingList("evolution", advanced, values, locked)),
      fold("PUNKTACJA (za co bot dostaje punkty)", false, settingList("score", Object.keys(schema.score), values, locked)),
      fold(`SIEĆ NEURONOWA - rozmiary warstw${locked ? " (zablokowane dla istniejącego modelu)" : ""}`, false, diagram, settingList("network", Object.keys(schema.network), values, locked)),
    );
    for (const [id, input] of inputs) if (id.startsWith("network.")) input.addEventListener("input", refresh);
    refresh();
  }

  const key = () => (locked ? selected : name.value.trim());
  const start = button(locked ? "KONTYNUUJ TRENING" : "START NOWEGO TRENINGU", () => void send("train", { run: key(), resume: locked, config: readForm() }));
  start.disabled = !!running;
  const save = button("ZAPISZ PARAMETRY", () => void send("config", { run: key(), config: readForm() }));
  save.disabled = !locked;
  const step3 = box("Krok 3: uruchom",
    line(locked ? "Zapisz parametry działa także w trakcie treningu: pola [zmiana na żywo] zadziałają od następnej generacji." : "Trening działa w tle, możesz zamknąć kartę."),
    line(start, " ", save, " ", msg));

  body.replaceChildren(state, tensorboardBox(), step1, box("Krok 2: ustawienia", line("Domyślne wartości są rozsądne. Każde pole ma opis."), form), step3, box("Log treningu", log));
}

/** While the form is being edited, only the status line and the log are refreshed. */
async function refreshStatus(): Promise<void> {
  const s = await call<Status>("status.json");
  const text = body.querySelector("p b");
  if (text) text.textContent = s.active ? `TRENING DZIAŁA: ${s.active}, generacja ${s.gen ?? "?"}` : "Żaden trening nie działa.";
  const run = s.active ?? selected;
  const pre = body.querySelector("pre:last-of-type");
  if (run && pre) pre.textContent = (await call<{ lines: string[] }>(`log/${run}`)).lines.join("\n") || "(brak logu)";
}

// ---------------------------------------------------------------- panel

const offline = (e: unknown) => body.replaceChildren(line(`Brak połączenia z serwerem deweloperskim (npm run dev): ${(e as Error).message}`));

async function refresh(): Promise<void> {
  if (panel.hidden || busy) return;
  try {
    if (tab === "train") await (inputs.size === 0 ? renderTrain() : refreshStatus());
  } catch (e) {
    offline(e);
  }
}

function setTab(t: "play" | "bots" | "train"): void {
  tab = t;
  tabs.querySelectorAll("button").forEach((b) => (b.disabled = b.dataset.tab === t)); // the open tab is the greyed-out one
  inputs.clear();
  body.replaceChildren(line("Ładowanie…"));
  if (t === "play") renderPlay();
  else void (t === "bots" ? renderBots() : renderTrain()).catch(offline);
}

/** With the panel open everything has a fixed size, so the game never moves or resizes when the tab (and its height) changes.
 *  Inline styles only, the <style> block of the page stays untouched. */
function layout(on: boolean): void {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const table = panel.closest("table")!;
  canvas.style.width = on ? "480px" : "";
  canvas.closest("td")!.style.width = on ? "480px" : "";
  panel.style.width = on ? "780px" : "";
  table.style.tableLayout = on ? "fixed" : "";
  table.style.width = on ? "1320px" : "";
  wrap.style.height = on ? "calc(100vh - 56px)" : "";
  wrap.style.overflowY = on ? "auto" : "";
}

function showPanel(on: boolean): void {
  panel.hidden = !on;
  layout(on);
  window.clearInterval(timer);
  if (on) {
    setTab(tab);
    timer = window.setInterval(() => void refresh(), 2500);
  }
  try { localStorage.setItem(PANEL_KEY, on ? "1" : "0"); } catch { /* private mode */ }
}

export function initBotMenu(gameApi: GameApi): void {
  api = gameApi;
  const open = document.getElementById("bot-open") as HTMLButtonElement;
  panel = document.getElementById("bot-panel")!;
  open.hidden = !import.meta.env.DEV;
  if (open.hidden) return;
  body = h("div", {});
  panel.style.lineHeight = "2"; // more air between lines (the lines inherit it)
  const labels: ["play" | "bots" | "train", string][] = [["play", "GRAJ"], ["bots", "BOTY"], ["train", "TRENING"]];
  tabs = h("p", {}, ...labels.flatMap(([id, text]) => {
    const b = h("button", { textContent: text });
    b.dataset.tab = id;
    b.onclick = () => { b.blur(); setTab(id); };
    return [b, " "];
  }));
  wrap = h("div", {});
  wrap.append(tabs, h("hr"), body);
  panel.append(wrap);
  open.onclick = () => { open.blur(); showPanel(Boolean(panel.hidden)); };
  let remembered = false;
  try { remembered = localStorage.getItem(PANEL_KEY) === "1"; } catch { /* private mode */ }
  showPanel(remembered || new URLSearchParams(location.search).has("watch"));
}

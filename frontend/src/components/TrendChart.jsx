import { useEffect, useRef, useState } from "react";

// Live trend chart for the D registers (plain SVG, no extra packages).
// Every line is drawn as a % of its own gauge range (Register settings: Gauge min / max),
// so registers with very different sizes (e.g. 20 °C and 1500 RPM) can be compared on one chart.
// History keeps RAW values, so changing the scale later re-draws old data correctly.

const COLORS = ["#e0a021", "#0a8fb0", "#e5566a", "#22a06b", "#9b6bd6", "#e8742a"];
const RANGES = [1, 5, 15]; // minutes
const MAX_MIN = 15;
const W = 1000;
const H = 260;
const PAD = { l: 56, r: 16, t: 14, b: 28 };

function extract(data) {
  const out = {};
  if (!data || typeof data !== "object") return out;
  const src = data.registers ?? data.regs ?? data.d ?? data.D ?? data.values ?? data;
  const num = (v) => {
    if (v && typeof v === "object" && "value" in v) v = v.value;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  if (Array.isArray(src)) {
    src.forEach((it, i) => {
      const n = num(it);
      if (n === null) return;
      const name = (it && (it.name ?? it.label ?? it.key ?? it.addr ?? it.address)) ?? `D${i}`;
      if (!/^y/i.test(String(name))) out[String(name)] = n;
    });
  } else {
    for (const [k, v] of Object.entries(src)) {
      const n = num(v);
      if (n !== null && !/^y/i.test(k)) out[k] = n;
    }
  }
  return out;
}

const fmtTime = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

const FALLBACK = { label: "", unit: "", scale: 1, offset: 0, decimals: 0, min: 0, max: 120 };

export default function TrendChart({ T, data, connected, tags }) {
  const [range, setRange] = useState(5);
  const [hist, setHist] = useState([]);
  const [hidden, setHidden] = useState({});
  const [now, setNow] = useState(Date.now());

  const latest = useRef({});
  const conn = useRef(false);
  const values = extract(data);
  latest.current = values;
  conn.current = !!connected;
  const keys = Object.keys(values);

  const tag = (k) => (tags ? tags.get(k) : { ...FALLBACK, label: k });
  const eng = (k, raw) => (tags ? tags.convert(k, raw) : raw);
  const pct = (k, raw) => {
    const t = tag(k);
    return ((eng(k, raw) - t.min) / (t.max - t.min)) * 100;
  };

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (!conn.current) return;
      if (Object.keys(latest.current).length === 0) return;
      const point = { t, ...latest.current };
      setHist((h) => [...h, point].filter((p) => t - p.t <= MAX_MIN * 60000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const from = now - range * 60000;
  const visible = hist.filter((p) => p.t >= from);

  let minp = 0, maxp = 100;
  for (const p of visible)
    for (const k of keys) {
      if (hidden[k] || p[k] === undefined) continue;
      const v = pct(k, p[k]);
      if (v > maxp) maxp = v;
      if (v < minp) minp = v;
    }
  const STEP = 25; // axis lines every 25 %
  const yMax = Math.max(100, Math.ceil(maxp / STEP) * STEP);
  const yMin = Math.min(0, Math.floor(minp / STEP) * STEP);

  const x = (t) => PAD.l + ((t - from) / (range * 60000)) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);

  const pathFor = (k) => {
    let d = "", pen = false;
    for (const p of visible) {
      if (p[k] === undefined) { pen = false; continue; }
      d += `${pen ? "L" : "M"}${x(p.t).toFixed(1)},${y(pct(k, p[k])).toFixed(1)} `;
      pen = true;
    }
    return d;
  };

  const yTicks = Array.from({ length: Math.round((yMax - yMin) / STEP) + 1 }, (_, i) => yMin + i * STEP);
  const xTicks = [0, 1, 2, 3, 4].map((i) => from + (range * 60000 * i) / 4);

  const btn = (active) => ({
    padding: "6px 14px", borderRadius: 8, cursor: "pointer", font: "inherit", fontWeight: 600,
    border: `1px solid ${active ? T.acc : T.line}`,
    background: active ? T.acc : "transparent",
    color: active ? T.onacc : T.ink,
  });

  return (
    <section style={{ padding: "20px 24px", borderTop: `1px solid ${T.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, borderLeft: `4px solid ${T.acc}`, paddingLeft: 10, fontSize: 20 }}>Trend</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {RANGES.map((m) => (
            <button key={m} style={btn(range === m)} onClick={() => setRange(m)}>{m} min</button>
          ))}
          <button style={btn(false)} onClick={() => setHist([])}>Clear</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "14px 0 8px" }}>
        {keys.map((k, i) => {
          const t = tag(k);
          return (
            <button
              key={k}
              onClick={() => setHidden((h) => ({ ...h, [k]: !h[k] }))}
              title="Click to show / hide"
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 8,
                border: `1px solid ${T.line}`, background: T.panel, color: T.ink, cursor: "pointer",
                font: "inherit", opacity: hidden[k] ? 0.4 : 1,
              }}
            >
              <span style={{ width: 14, height: 4, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
              <b>{t.label || k}</b>
              <span style={{ color: T.mute }}>
                {eng(k, values[k]).toFixed(t.decimals)}{t.unit ? " " + t.unit : ""}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: T.shadow, padding: 8, overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 520, height: "auto", display: "block" }}>
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={T.line} />
              <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill={T.mute}>{Math.round(v)}%</text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text key={i} x={x(t)} y={H - 8} fontSize="12" fill={T.mute}
              textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}>{fmtTime(t)}</text>
          ))}
          {keys.map((k, i) =>
            hidden[k] ? null : (
              <path key={k} d={pathFor(k)} fill="none" stroke={COLORS[i % COLORS.length]}
                strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
            )
          )}
          {visible.length === 0 && (
            <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="15" fill={T.mute}>
              {connected ? "Collecting data..." : "Connect to a PLC (or DEMO) to see the trend."}
            </text>
          )}
        </svg>
      </div>
      <div style={{ color: T.mute, fontSize: ".8rem", marginTop: 6 }}>
        Each line is shown as % of its own gauge range (set Gauge min / max in Register settings).
      </div>
    </section>
  );
}
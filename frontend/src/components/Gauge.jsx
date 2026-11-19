import { RING, GAUGE_MAX, NUM } from "../config";

// value = raw PLC value. tag = resolved tag from useTags().get(key) (optional).
export default function Gauge({ T, name, value, alarm, tag }) {
  const t = tag || { label: name, unit: "", scale: 1, offset: 0, decimals: 0, min: 0, max: GAUGE_MAX };
  const ok = Number.isFinite(value);
  const eng = ok ? value * t.scale + t.offset : 0;
  // clamp to the configured range so negative / huge values never break the ring
  const pct = Math.max(0, Math.min(1, (eng - t.min) / (t.max - t.min)));
  const text = ok ? eng.toFixed(t.decimals) : "--";
  const size = text.length > 6 ? "1.7rem" : text.length > 4 ? "2.1rem" : text.length > 3 ? "2.5rem" : "2.9rem";
  const col = alarm ? T.err : T.acc;

  const S = {
    g: {
      background: `linear-gradient(160deg, ${T.panel}, ${T.bg})`, border: `1px solid ${alarm ? T.err : T.line}`,
      borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", alignItems: "center",
      gap: 10, boxShadow: T.shadow,
    },
    ring: { position: "relative", width: 150, height: 150 },
    svg: { width: "100%", height: "100%", transform: "rotate(-90deg)" },
    track: { fill: "none", strokeWidth: 12, stroke: T.track },
    val: {
      fill: "none", strokeWidth: 12, strokeLinecap: "round", stroke: col, strokeDasharray: RING,
      strokeDashoffset: RING * (1 - pct), transition: "stroke-dashoffset .6s ease",
      filter: `drop-shadow(0 0 6px ${col}88)`,
    },
    center: { position: "absolute", inset: 0, display: "grid", placeContent: "center", textAlign: "center" },
    num: { ...NUM, fontSize: size, fontWeight: 700, lineHeight: 1 },
    unit: { fontSize: ".85rem", color: T.mute, marginTop: 4, minHeight: "1em" },
    label: { fontWeight: 600, fontSize: "1rem", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" },
    addr: { fontSize: ".8rem", color: T.mute, letterSpacing: 0.3 },
  };

  return (
    <div style={S.g}>
      <div style={S.ring}>
        <svg viewBox="0 0 120 120" style={S.svg}>
          <circle cx="60" cy="60" r="54" style={S.track} />
          <circle cx="60" cy="60" r="54" style={S.val} />
        </svg>
        <div style={S.center}>
          <b style={S.num}>{text}</b>
          <small style={S.unit}>{t.unit}</small>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={S.label} title={t.label}>{t.label}</div>
        {t.label !== name && <div style={S.addr}>{name}</div>}
      </div>
    </div>
  );
}
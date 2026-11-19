import { useState } from "react";

// Register settings: name, unit, scaling and gauge range for every D register.
export default function TagsPanel({ T, data, tags }) {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(data?.d ?? {});

  const input = {
    width: "100%", padding: "7px 10px", borderRadius: 8, font: "inherit",
    background: T.panel2, color: T.ink, border: `1px solid ${T.line}`,
  };
  const lab = { fontSize: ".78rem", color: T.mute, marginBottom: 4, display: "block" };
  const btn = (primary) => ({
    padding: "6px 14px", borderRadius: 8, cursor: "pointer", font: "inherit", fontWeight: 600,
    border: `1px solid ${primary ? T.acc : T.line}`, background: primary ? T.acc : "transparent",
    color: primary ? T.onacc : T.ink,
  });

  // plain function (NOT a component) so the input is not re-created on every render
  const field = (k, f, label, hint, mode) => (
    <label key={f}>
      <span style={lab}>{label}</span>
      <input
        style={input}
        value={tags.getRaw(k)[f]}
        inputMode={mode || "text"}
        placeholder={hint}
        onChange={(e) => tags.set(k, { [f]: e.target.value })}
      />
    </label>
  );

  return (
    <section style={{ padding: "20px 24px", borderTop: `1px solid ${T.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, borderLeft: `4px solid ${T.acc}`, paddingLeft: 10, fontSize: 20 }}>Register settings</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ color: T.mute, fontSize: ".85rem" }}>
            Name, unit, scaling and gauge range · saved in this browser
          </span>
          <button style={btn(open)} onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Edit"}</button>
        </div>
      </div>

      {open && (
        <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
          {keys.length === 0 && (
            <div style={{ color: T.mute }}>Connect to a PLC (or DEMO) to see the registers.</div>
          )}
          {keys.map((k) => {
            const raw = data.d[k];
            return (
              <div key={k} style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, boxShadow: T.shadow }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  <b style={{ fontSize: "1.05rem" }}>{k}</b>
                  <span style={{ color: T.mute }}>
                    raw {raw} → <b style={{ color: T.ink }}>{tags.format(k, raw)} {tags.get(k).unit}</b>
                  </span>
                  <button style={btn(false)} onClick={() => tags.reset(k)}>Reset</button>
                </div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
                  {field(k, "label", "Name", k, undefined)}
                  {field(k, "unit", "Unit", "°C, bar, RPM", undefined)}
                  {field(k, "scale", "Scale (x)", undefined, "decimal")}
                  {field(k, "offset", "Offset (+)", undefined, "decimal")}
                  {field(k, "decimals", "Decimals", undefined, "numeric")}
                  {field(k, "min", "Gauge min", undefined, "decimal")}
                  {field(k, "max", "Gauge max", undefined, "decimal")}
                </div>
              </div>
            );
          })}
          <div style={{ color: T.mute, fontSize: ".85rem" }}>
            Value shown = raw x Scale + Offset. Example: raw 253, Scale 0.1 → 25.3. Gauge min / max use the scaled value.
          </div>
        </div>
      )}
    </section>
  );
}
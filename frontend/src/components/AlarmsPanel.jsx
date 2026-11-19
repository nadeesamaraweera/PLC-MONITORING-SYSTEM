import { NUM } from "../config";
import { Section, Label, Field, Btn } from "./ui";

export default function AlarmsPanel({ T, data, alarms, tags }) {
  const { active, getLimit, setLimit, enabled, setEnabled, sound, setSound, testSound, ack, ackAll } = alarms;
  const names = Object.keys(data?.d ?? {});
  const anyUnacked = Object.values(active).some((a) => !a.acked);

  const S = {
    top: { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "14px 20px 6px" },
    check: { display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 500 },
    box: { width: 18, height: 18, accentColor: T.acc, cursor: "pointer" },
    comm: (bad) => ({ marginLeft: "auto", fontWeight: 600, color: bad ? T.err : T.on }),
    grid: { display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", padding: "10px 20px 22px" },
    card: (a) => ({
      display: "flex", flexDirection: "column", gap: 10, borderRadius: 12, padding: 16, boxShadow: T.shadow,
      background: `linear-gradient(160deg, ${T.panel}, ${T.bg})`,
      border: `1px solid ${a ? T.err : T.line}`,
    }),
    row: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
    name: { ...NUM, fontSize: "1.3rem", fontWeight: 700 },
    status: (a) => ({ fontSize: ".82rem", fontWeight: 600, color: a ? T.err : T.on }),
    inputs: { display: "flex", gap: 12 },
    empty: { margin: 0, padding: "10px 20px 22px", color: T.mute, fontSize: ".9rem" },
  };

  const commBad = !!active.COMM;

  return (
    <Section T={T} i={3} title="Alarms" note="Limits are in the register's unit · saved in this browser · leave a limit empty for none">
      <div style={S.top}>
        <label style={S.check}>
          <input type="checkbox" style={S.box} checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Alarms on
        </label>
        <label style={S.check}>
          <input type="checkbox" style={S.box} checked={sound} onChange={(e) => setSound(e.target.checked)} />
          Beep
        </label>
        <div style={{ flex: "0 0 140px", display: "flex" }}>
          <Btn T={T} onClick={testSound}>Test beep</Btn>
        </div>
        <div style={{ flex: "0 0 170px", display: "flex" }}>
          <Btn T={T} onClick={ackAll}>{anyUnacked ? "Acknowledge all" : "No new alarms"}</Btn>
        </div>
        <span style={S.comm(commBad)}>{commBad ? "Communication: LOST" : "Communication: OK"}</span>
      </div>

      {names.length === 0 ? (
        <p style={S.empty}>Connect to a PLC (or DEMO) to set the limits.</p>
      ) : (
        <div style={S.grid}>
          {names.map((k) => {
            const a = active[k];
            const t = tags.get(k);
            const u = t.unit ? ` (${t.unit})` : "";
            const L = getLimit(k);
            const inp = (field, label) => (
              <Label T={T} text={label}>
                <Field T={T} as="input" type="number" step="any" value={L[field]} onChange={(e) => setLimit(k, field, e.target.value)} />
              </Label>
            );
            return (
              <div key={k} style={S.card(a)}>
                <div style={S.row}>
                  <span style={S.name}>{t.label}{t.label !== k ? ` · ${k}` : ""}</span>
                  <span style={S.status(a)}>
                    {a
                      ? `${a.type} · ${Number(a.value).toFixed(a.decimals)}${a.unit ? " " + a.unit : ""}${a.acked ? " · ack" : ""}`
                      : `OK · ${tags.format(k, data.d[k])}${t.unit ? " " + t.unit : ""}`}
                  </span>
                </div>
                <div style={S.inputs}>
                  {inp("high", `High limit${u}`)}
                  {inp("low", `Low limit${u}`)}
                </div>
                <div style={S.inputs}>
                  {inp("hyst", `Hysteresis${u}`)}
                  {inp("delay", "On-delay (s)")}
                </div>
                {a && !a.acked && <Btn T={T} onClick={() => ack(k)}>Acknowledge</Btn>}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
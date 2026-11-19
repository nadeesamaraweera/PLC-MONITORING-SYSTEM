import { Section } from "./ui";
import Gauge from "./Gauge";

export default function RegistersPanel({ T, data, active = {}, tags }) {
  const grid = {
    display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", padding: "14px 20px 22px",
  };
  return (
    <Section T={T} i={1} title="Data registers" note="Live values read from the PLC">
      <div style={grid}>
        {Object.entries(data?.d ?? {}).map(([k, v]) => (
          <Gauge key={k} T={T} name={k} value={v} alarm={!!active[k]} tag={tags ? tags.get(k) : undefined} />
        ))}
      </div>
    </Section>
  );
}
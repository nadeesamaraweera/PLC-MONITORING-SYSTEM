import { NUM } from "../config";
import { Section } from "./ui";

export default function EventLog({ T, log }) {
  const S = {
    list: { listStyle: "none", margin: 0, padding: "6px 20px 14px", maxHeight: 210, overflowY: "auto", fontSize: ".9rem" },
    item: { display: "flex", gap: 14, padding: "9px 0", borderBottom: `1px solid ${T.line}` },
    time: { ...NUM, color: T.acc, fontSize: "1rem", fontWeight: 500 },
  };

  return (
    <Section T={T} i={5} title="Event log">
      <ul style={S.list}>
        {log.length === 0 && <li style={S.item}><span>No events yet.</span></li>}
        {log.map((e, i) => <li key={i} style={S.item}><time style={S.time}>{e.t}</time><span>{e.text}</span></li>)}
      </ul>
    </Section>
  );
}
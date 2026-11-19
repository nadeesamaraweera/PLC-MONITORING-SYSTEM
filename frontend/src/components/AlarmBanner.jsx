/* Bar at the top of the page while any alarm is active.
   Red + flashing until acknowledged, then a quiet red-edged bar until the value is back to normal. */
export default function AlarmBanner({ T, active, onAckAll }) {
  const list = Object.entries(active);
  if (list.length === 0) return null;
  const unacked = list.some(([, a]) => !a.acked);

  const S = {
    bar: {
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 22px", padding: "10px 20px",
      background: unacked ? T.err : T.panel2, color: unacked ? "#fff" : T.err, fontWeight: 600,
      borderLeft: `6px solid ${T.err}`, borderBottom: `1px solid ${T.line}`,
      animation: unacked ? "alarmFlash 1s steps(2, jump-none) infinite" : "none",
    },
    item: { display: "inline-flex", gap: 8, alignItems: "center" },
    btn: {
      marginLeft: "auto", padding: "6px 16px", borderRadius: 8, cursor: "pointer", font: "inherit", fontWeight: 700,
      border: "2px solid #fff", background: "#fff", color: "#b00020",
    },
  };

  const text = (a) =>
    a.type === "COMM"
      ? "COMMUNICATION LOST · no data from the PLC"
      : `${a.label} ${a.type === "HIGH" ? "above" : "below"} ${Number(a.limit).toFixed(a.decimals)}${a.unit ? " " + a.unit : ""} (now ${Number(a.value).toFixed(a.decimals)}${a.unit ? " " + a.unit : ""})${a.acked ? " · acknowledged" : ""}`;

  return (
    <div style={S.bar} role="alert">
      <style>{`
        @keyframes alarmFlash { 50% { background: #7a0016; } }
        @media (prefers-reduced-motion: reduce) { [role="alert"] { animation: none !important; } }
      `}</style>
      <span>⚠ ALARM</span>
      {list.map(([k, a]) => (
        <span key={k} style={S.item}>{text(a)}</span>
      ))}
      {unacked && <button style={S.btn} onClick={onAckAll}>Acknowledge</button>}
    </div>
  );
}
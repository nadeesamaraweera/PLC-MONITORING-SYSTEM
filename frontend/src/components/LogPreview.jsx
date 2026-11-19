import { NUM } from "../config";

/* Table with the last logged rows (newest first) */
export default function LogPreview({ T, preview }) {
  const rows = preview?.rows ?? [];
  const header = preview?.header ?? [];
  const S = {
    wrap: { margin: "0 20px 20px", border: `1px solid ${T.line}`, borderRadius: 10, overflowX: "auto", background: T.bg },
    table: { width: "100%", borderCollapse: "collapse", fontSize: ".88rem", whiteSpace: "nowrap" },
    th: { ...NUM, textAlign: "left", padding: "9px 14px", fontWeight: 600, color: T.mute, borderBottom: `1px solid ${T.line}`, background: T.panel },
    td: { ...NUM, textAlign: "left", padding: "8px 14px", borderBottom: `1px solid ${T.line}` },
    y: (on) => ({ ...NUM, textAlign: "left", padding: "8px 14px", borderBottom: `1px solid ${T.line}`, color: on ? T.on : T.mute, fontWeight: on ? 600 : 400 }),
    empty: { margin: 0, padding: "16px 14px", fontSize: ".88rem", color: T.mute },
  };

  return (
    <div style={S.wrap}>
      {rows.length === 0 ? (
        <p style={S.empty}>No rows yet. Connect, then press Start logging.</p>
      ) : (
        <table style={S.table}>
          <thead>
            <tr>{header.map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row[0] + i}>
                {row.map((cell, j) => {
                  const h = header[j] || "";
                  if (/^Y\d+/.test(h)) {
                    const on = cell === "1";
                    return <td key={j} style={S.y(on)}>{on ? "ON" : "OFF"}</td>;
                  }
                  return <td key={j} style={S.td}>{cell}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
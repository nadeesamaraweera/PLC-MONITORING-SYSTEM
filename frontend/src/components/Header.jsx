import { useEffect, useState } from "react";
import { LOGO_SRC, NUM } from "../config";

export default function Header({ plc }) {
  const { connected, data, auto, modelName } = plc;
  const [clock, setClock] = useState(new Date());

  // the clock has its own state, so only the header re-renders every second
  useEffect(() => {
    const c = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(c);
  }, []);

  const S = {
    top: {
      position: "sticky", top: 0, zIndex: 5, width: "100%",
      background: "linear-gradient(100deg, #ffffff 0%, #eef4f8 22%, #9dbccd 48%, #2a5670 74%, #0f2c3d 100%)",
      boxShadow: "0 4px 18px rgba(0,0,0,.25)",
    },
    topLine: { height: 2, background: "linear-gradient(90deg, #f2b134, #ffd36b 40%, #14a6c9 100%)" },
    bar: { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "8px 20px" },
    brand: { display: "flex", alignItems: "center", gap: 12, marginRight: "auto" },
    logo: { height: "clamp(60px, 9vw, 88px)", width: "auto", maxWidth: 260, margin: "-8px 0", objectFit: "contain", display: "block", flex: "none" },
    title: {
      margin: 0, fontFamily: '"Rajdhani", "Barlow Condensed", sans-serif', fontSize: "2rem", fontWeight: 700,
      lineHeight: 1.05, color: "#0b2a3a", letterSpacing: 3, textTransform: "uppercase",
      textShadow: "0 1px 0 rgba(255,255,255,.6)",
    },
    subtitle: {
      margin: "2px 0 0", fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif', fontSize: "1rem",
      fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: "#2f5568",
    },
    pill: {
      display: "flex", alignItems: "center", gap: 9, color: "#fff", fontSize: ".9rem",
      background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.3)",
      borderRadius: 99, padding: "7px 16px", backdropFilter: "blur(6px)",
    },
    dot: {
      width: 9, height: 9, borderRadius: "50%", background: connected ? "#3ddc97" : "#f2b134",
      boxShadow: connected ? "0 0 0 4px rgba(61,220,151,.3)" : "none",
    },
    clock: { ...NUM, fontSize: "1.4rem", fontWeight: 500, color: "#fff", minWidth: 90, textAlign: "right", letterSpacing: 0.5 },
  };

  return (
    <div style={S.top}>
      <div style={S.bar}>
        <div style={S.brand}>
          <img style={S.logo} src={LOGO_SRC} alt="Sri Luck Automation" />
          <div>
            <h1 style={S.title}>Sri Luck Automation</h1>
            <p style={S.subtitle}>PLC Monitor{modelName ? " · " + modelName : ""}</p>
          </div>
        </div>
        <div style={S.pill}>
          <i style={S.dot} />
          <span>
            {connected
              ? `Connected${data.demo ? " (demo)" : ""} · ${data.updated ?? "-"}`
              : auto ? "Reconnecting…" : "PLC not connected"}
          </span>
        </div>
        <div style={S.clock}>{clock.toLocaleTimeString("en-GB")}</div>
      </div>
      <div style={S.topLine} />
    </div>
  );
}
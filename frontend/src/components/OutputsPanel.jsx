import { useEffect, useState } from "react";
import { NUM } from "../config";
import { Section } from "./ui";

/* PLC outputs. Locked = view only.
   Unlocked (PIN) = click an output -> confirm -> write -> PLC read-back check -> event log. */
export default function OutputsPanel({ T, data, control, addLog }) {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const connected = !!data?.connected;
  const names = Object.keys(data?.y ?? {});
  const { unlocked } = control;
  const canWrite = unlocked && connected && !busy;

  // link lost / disconnected -> lock control
  useEffect(() => {
    if (!connected && unlocked) control.lock();
  }, [connected]);

  const doUnlock = async () => {
    if (!pin) return;
    const r = await control.unlock(pin);
    setPin("");
    if (r.ok) { setMsg(""); addLog("Output control unlocked"); }
    else setMsg(r.error);
  };
  const doLock = () => { control.lock(); setMsg(""); addLog("Output control locked"); };

  const toggle = async (name) => {
    const next = !data.y[name];
    if (!window.confirm(`Turn ${name} ${next ? "ON" : "OFF"}?\n\nThis switches a real output on the PLC.`)) return;
    setBusy(true);
    const r = await control.write(name, next);
    setBusy(false);
    if (r.ok) { setMsg(""); addLog(`CONTROL ${name} set ${next ? "ON" : "OFF"} (confirmed by PLC)`); }
    else { setMsg(r.error); addLog(`CONTROL ${name} ${next ? "ON" : "OFF"} FAILED: ${r.error}`); }
  };

  const S = {
    bar: { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "14px 20px 4px" },
    badge: (on) => ({ fontWeight: 700, color: on ? T.acc : T.mute }),
    pin: {
      width: 140, padding: "8px 12px", borderRadius: 8, font: "inherit",
      background: T.panel2, color: T.ink, border: `1px solid ${T.line}`,
    },
    btn: (primary) => ({
      padding: "8px 18px", borderRadius: 8, cursor: "pointer", font: "inherit", fontWeight: 600,
      border: `1px solid ${primary ? T.acc : T.line}`, background: primary ? T.acc : "transparent",
      color: primary ? T.onacc : T.ink,
    }),
    msg: { padding: "0 20px", color: T.err, fontWeight: 500 },
    grid: { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", padding: "10px 20px 22px" },
    card: (on) => ({
      display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 12, width: "100%",
      textAlign: "left", font: "inherit", color: T.ink, boxShadow: T.shadow,
      background: `linear-gradient(160deg, ${T.panel}, ${T.bg})`,
      border: `1px solid ${on ? T.on : T.line}`,
      cursor: canWrite ? "pointer" : "default",
    }),
    led: (on) => ({
      width: 22, height: 22, borderRadius: "50%", flex: "none",
      background: on ? T.on : T.track, boxShadow: on ? `0 0 10px ${T.on}` : "none",
    }),
    name: { ...NUM, fontSize: "1.15rem", fontWeight: 700, lineHeight: 1.1 },
    st: (on) => ({ fontSize: ".8rem", fontWeight: 600, color: on ? T.on : T.mute }),
  };

  return (
    <Section T={T} i={2} title="Outputs" note={unlocked ? "Control enabled · click an output to switch it" : "Y000 – Y003 · view only"}>
      <div style={S.bar}>
        {unlocked ? (
          <>
            <span style={S.badge(true)}>Control: ENABLED</span>
            <button style={S.btn(false)} onClick={doLock}>Lock</button>
            <span style={{ color: T.mute, fontSize: ".85rem" }}>Locks itself after 5 min without use</span>
          </>
        ) : (
          <>
            <span style={S.badge(false)}>Control: LOCKED</span>
            <input
              type="password" inputMode="numeric" autoComplete="off" placeholder="PIN" value={pin} style={S.pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doUnlock()}
              disabled={!connected}
            />
            <button style={S.btn(true)} onClick={doUnlock} disabled={!connected}>Unlock</button>
            {!connected && <span style={{ color: T.mute, fontSize: ".85rem" }}>Connect to a PLC first</span>}
          </>
        )}
      </div>
      {msg && <div style={S.msg} role="alert">{msg}</div>}

      <div style={S.grid}>
        {names.map((k) => {
          const on = !!data.y[k];
          const inner = (
            <>
              <span style={S.led(on)} />
              <span>
                <div style={S.name}>{k}</div>
                <div style={S.st(on)}>{on ? "ON" : "OFF"}</div>
              </span>
            </>
          );
          return unlocked ? (
            <button key={k} style={S.card(on)} disabled={!canWrite} onClick={() => toggle(k)}
              title={`Click to turn ${k} ${on ? "OFF" : "ON"}`}>{inner}</button>
          ) : (
            <div key={k} style={S.card(on)}>{inner}</div>
          );
        })}
      </div>
    </Section>
  );
}
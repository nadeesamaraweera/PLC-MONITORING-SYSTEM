import { useEffect, useState } from "react";
import { FONT } from "./config";
import { useEventLog } from "./hooks/useEventLog";
import { usePlc } from "./hooks/usePlc";
import { useLogging } from "./hooks/useLogging";
import { useAlarms } from "./hooks/useAlarms";
import { useTags } from "./hooks/useTags";
import { useControl } from "./hooks/useControl";
import Header from "./components/Header";
import ConnectionPanel from "./components/ConnectionPanel";
import RegistersPanel from "./components/RegistersPanel";
import OutputsPanel from "./components/OutputsPanel";
import AlarmBanner from "./components/AlarmBanner";
import AlarmsPanel from "./components/AlarmsPanel";
import LoggingPanel from "./components/LoggingPanel";
import EventLog from "./components/EventLog";
import TrendChart from "./components/TrendChart";
import TagsPanel from "./components/TagsPanel";

/* ---------- Theme colors (light / dark auto) - passed to every component as T ---------- */
const LIGHT = {
  bg: "#e9eff3", panel: "#ffffff", panel2: "#f3f7f9", ink: "#10303f", mute: "#5a7482",
  line: "#d3dfe5", acc: "#0a6c8c", acc2: "#14a6c9", on: "#14a06f", track: "#dde6ea",
  onacc: "#ffffff", err: "#b00020", shadow: "0 1px 2px rgba(16,48,63,.06), 0 6px 18px rgba(16,48,63,.06)",
};
const DARK = {
  bg: "#0a1620", panel: "#11293a", panel2: "#0d2130", ink: "#e4eff4", mute: "#8aa5b3",
  line: "#22414f", acc: "#f2b134", acc2: "#ffd36b", on: "#3ddc97", track: "#1f3b4a",
  onacc: "#1a1200", err: "#ff7b8a", shadow: "0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.25)",
};

function useTheme() {
  const q = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = (e) => setDark(e.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return dark ? DARK : LIGHT;
}

/* Only hover / focus / fonts need real css (cannot be done inline) */
const globalCss = (T) => `
@import url("https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600;700&display=swap");
html, body { margin: 0; padding: 0; width: 100%; }
#root { width: 100%; max-width: none; margin: 0; padding: 0; text-align: left; }
* { box-sizing: border-box; }
button:hover { filter: brightness(1.08); }
button:active { transform: translateY(1px); }
select:hover, input:hover { border-color: ${T.acc2} !important; }
:focus-visible { outline: 3px solid ${T.acc2}; outline-offset: 2px; }
`;

export default function App() {
  const T = useTheme();

  const { log, addLog } = useEventLog();
  const plc = usePlc(addLog);
  const logging = useLogging(addLog);
  const tags = useTags(); // register names, units, scaling, gauge range
  const control = useControl(); // PIN-protected output control
  // expectConnected: the PLC should be connected (auto-reconnect on) but is not -> COMM LOST alarm
  const alarms = useAlarms(plc.data, addLog, tags, plc.auto && !plc.connected);

  // page background / text color (body)
  useEffect(() => {
    Object.assign(document.body.style, {
      color: T.ink, fontFamily: FONT, lineHeight: 1.45, minHeight: "100vh", display: "block",
      background: `radial-gradient(900px 420px at 85% -80px, ${T.acc}1a, transparent 70%), ${T.bg}`,
    });
  }, [T]);

  return (
    <>
      <style>{globalCss(T)}</style>
      <Header plc={plc} />
      <AlarmBanner T={T} active={alarms.active} onAckAll={alarms.ackAll} />
      <main style={{ width: "100%", paddingBottom: 40 }}>
        <ConnectionPanel T={T} plc={plc} />
        <RegistersPanel T={T} data={plc.data} active={alarms.active} tags={tags} />
        <OutputsPanel T={T} data={plc.data} control={control} addLog={addLog} />
        <AlarmsPanel T={T} data={plc.data} alarms={alarms} tags={tags} />
        <TrendChart T={T} data={plc.data} connected={!!plc.data} tags={tags} />
        <TagsPanel T={T} data={plc.data} tags={tags} />
        <LoggingPanel T={T} logging={logging} />
        <EventLog T={T} log={log} />
      </main>
    </>
  );
}
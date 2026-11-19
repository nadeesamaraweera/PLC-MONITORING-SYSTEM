import { useEffect, useState } from "react";
import { API } from "../config";

/* Data logging: start / stop / clear / download + live preview of the last rows */
export function useLogging(addLog) {
  const [logSt, setLogSt] = useState({ active: false, interval: 5, rows: 0 });
  const [logInterval, setLogInterval] = useState(5);
  const [logMsg, setLogMsg] = useState("");
  const [preview, setPreview] = useState({ header: [], rows: [] });

  // poll logging status + last rows
  useEffect(() => {
    const t = setInterval(() => {
      fetch(`${API}/log/status`).then((r) => r.json()).then(setLogSt).catch(() => {});
      fetch(`${API}/log/preview?limit=15`)
        .then((r) => (r.ok ? r.json() : null))
        .then((p) => { if (p && Array.isArray(p.rows) && Array.isArray(p.header)) setPreview(p); })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(t);
  }, []);

  // POST to /log/<path>; throws if the backend is down or returns an error
  const logCall = async (path, body) => {
    const r = await fetch(`${API}/log/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!r.ok) throw new Error("request failed");
    setLogSt(await r.json());
  };

  const startLog = async () => {
    setLogMsg("");
    try { await logCall("start", { interval: logInterval }); addLog(`Logging started (every ${logInterval} s)`); }
    catch { setLogMsg("Cannot reach the backend."); }
  };
  const stopLog = async () => {
    try { await logCall("stop"); addLog("Logging stopped"); }
    catch { setLogMsg("Cannot reach the backend."); }
  };
  const clearLog = async () => {
    if (!window.confirm("Delete all logged rows?")) return;
    try { await logCall("clear"); setLogMsg("Log cleared."); }
    catch { setLogMsg("Cannot reach the backend."); }
  };

  const download = async (fmt) => {
    setLogMsg("");
    try {
      const r = await fetch(`${API}/log/download?format=${fmt}`);
      if (!r.ok) { setLogMsg((await r.json()).detail); return; }
      const url = URL.createObjectURL(await r.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `plc_log.${fmt}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setLogMsg("Cannot reach the backend.");
    }
  };

  return { logSt, logInterval, setLogInterval, logMsg, preview, startLog, stopLog, clearLog, download };
}
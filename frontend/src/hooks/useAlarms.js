import { useEffect, useRef, useState } from "react";

const KEY = "plc_alarms";
const DEFAULT_LIMIT = { high: "", low: "", hyst: "0", delay: "0" }; // "" = no limit
const COMM_DELAY_MS = 5000;  // no data for 5 s -> COMMUNICATION LOST
const BEEP_EVERY_MS = 3000;  // beep repeats until the alarm is acknowledged

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
};
const num = (x) => (x === "" || x === undefined || x === null || !Number.isFinite(Number(x)) ? null : Number(x));
const fmt = (v, dec, unit) => `${Number(v).toFixed(dec)}${unit ? " " + unit : ""}`;

/* Industrial style alarms (limits are in engineering units, e.g. °C):
   - High / Low limit per register
   - Hysteresis: alarm clears only after the value is this far back inside the limit
   - On-delay: value must stay beyond the limit this many seconds before the alarm starts
   - Acknowledge: beep repeats and the banner flashes until the operator acknowledges
   - Communication lost alarm when the PLC link drops
   expectConnected = true when the PLC should be connected (auto-reconnect is on). */
export function useAlarms(data, addLog, tags, expectConnected) {
  const [saved] = useState(load);
  const [limits, setLimits] = useState(saved.limits || {});
  const [enabled, setEnabled] = useState(saved.enabled ?? true);
  const [sound, setSound] = useState(saved.sound ?? true);
  const [active, setActive] = useState({});

  const ctxRef = useRef(null);
  const activeRef = useRef({});   // register -> { type, value, limit, label, unit, decimals, since, acked }
  const pending = useRef({});     // on-delay timers
  const commSince = useRef(null);
  const lastBeep = useRef(0);
  const live = useRef({});
  live.current = { data, limits, enabled, sound, tags, expectConnected, addLog };

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ limits, enabled, sound })); } catch {}
  }, [limits, enabled, sound]);

  const getLimit = (k) => ({ ...DEFAULT_LIMIT, ...(limits[k] || {}) });
  const setLimit = (k, field, value) =>
    setLimits((l) => ({ ...l, [k]: { ...DEFAULT_LIMIT, ...(l[k] || {}), [field]: value } }));

  // short beep (the browser only allows sound after you clicked something on the page)
  const beep = () => {
    try {
      if (!ctxRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctxRef.current = new AC();
      }
      const ctx = ctxRef.current;
      ctx.resume?.();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 880;
      g.gain.value = 0.08;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.35);
    } catch {}
  };

  const publish = () => {
    const snap = Object.fromEntries(Object.entries(activeRef.current).map(([k, a]) => [k, { ...a }]));
    setActive((prev) => (JSON.stringify(prev) === JSON.stringify(snap) ? prev : snap));
  };

  const ack = (k) => {
    const a = activeRef.current[k];
    if (a && !a.acked) {
      a.acked = true;
      live.current.addLog(`ALARM ${a.type === "COMM" ? "COMMUNICATION" : a.label} acknowledged`);
      publish();
    }
  };
  const ackAll = () => Object.keys(activeRef.current).forEach(ack);

  // runs once a second
  const tick = () => {
    const { data, limits, enabled, sound, tags, expectConnected, addLog } = live.current;
    const A = activeRef.current;
    const now = Date.now();

    if (!enabled) {
      Object.keys(A).forEach((k) => delete A[k]);
      pending.current = {};
      commSince.current = null;
      publish();
      return;
    }

    // ----- communication lost -----
    const connected = !!data?.connected;
    if (expectConnected && !connected) {
      if (commSince.current === null) commSince.current = now;
      if (!A.COMM && now - commSince.current >= COMM_DELAY_MS) {
        A.COMM = { type: "COMM", label: "Communication", since: now, acked: false };
        addLog("ALARM COMMUNICATION LOST: no data from the PLC");
      }
    } else {
      commSince.current = null;
      if (A.COMM) { delete A.COMM; addLog("Communication restored"); }
    }

    // ----- value alarms (only while data is live) -----
    if (connected) {
      for (const k of Object.keys(data.d ?? {})) {
        const raw = data.d[k];
        if (!Number.isFinite(raw)) continue;
        const t = tags.get(k);
        const v = tags.convert(k, raw);
        const L = { ...DEFAULT_LIMIT, ...(limits[k] || {}) };
        const high = num(L.high);
        const low = num(L.low);
        const hyst = Math.max(0, num(L.hyst) ?? 0);
        const delay = Math.max(0, num(L.delay) ?? 0);
        const cur = A[k];

        if (cur) {
          const cleared =
            cur.type === "HIGH" ? high === null || v <= high - hyst : low === null || v >= low + hyst;
          if (cleared) {
            delete A[k];
            addLog(`${t.label} back to normal: ${fmt(v, t.decimals, t.unit)}`);
          } else {
            cur.value = v;
            cur.limit = cur.type === "HIGH" ? high : low;
            cur.label = t.label; cur.unit = t.unit; cur.decimals = t.decimals;
          }
          continue;
        }

        let type = null;
        if (high !== null && v > high) type = "HIGH";
        else if (low !== null && v < low) type = "LOW";
        if (!type) { delete pending.current[k]; continue; }

        if (!pending.current[k] || pending.current[k].type !== type) pending.current[k] = { type, since: now };
        if (now - pending.current[k].since >= delay * 1000) {
          const limit = type === "HIGH" ? high : low;
          A[k] = { type, value: v, limit, label: t.label, unit: t.unit, decimals: t.decimals, since: now, acked: false };
          delete pending.current[k];
          addLog(`ALARM ${t.label} ${type}: ${fmt(v, t.decimals, t.unit)} (limit ${fmt(limit, t.decimals, t.unit)})`);
        }
      }
    }

    // ----- beep until acknowledged -----
    const unacked = Object.values(A).some((a) => !a.acked);
    if (unacked && sound && now - lastBeep.current >= BEEP_EVERY_MS) {
      lastBeep.current = now;
      beep();
    }
    if (!unacked) lastBeep.current = 0;

    publish();
  };

  useEffect(() => {
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return { active, getLimit, setLimit, enabled, setEnabled, sound, setSound, testSound: beep, ack, ackAll };
}
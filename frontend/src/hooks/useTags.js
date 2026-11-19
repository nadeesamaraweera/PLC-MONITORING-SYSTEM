import { useEffect, useState } from "react";
import { GAUGE_MAX } from "../config";

// "Tag" configuration for every D register (name, unit, scaling, gauge range).
// Saved in the browser. Values are kept as strings so typing "0." works in inputs.
const KEY = "plc_tags";
const DEFAULT = { label: "", unit: "", scale: "1", offset: "0", decimals: "0", min: "0", max: String(GAUGE_MAX) };

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
};
const num = (x, fallback) => {
  const v = parseFloat(x);
  return Number.isFinite(v) ? v : fallback;
};

export function useTags() {
  const [store, setStore] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {}
  }, [store]);

  // raw strings for the edit boxes
  const getRaw = (key) => ({ ...DEFAULT, ...(store[key] || {}) });

  // clean numeric version used by gauge / chart
  const get = (key) => {
    const t = getRaw(key);
    const min = num(t.min, 0);
    let max = num(t.max, GAUGE_MAX);
    if (max <= min) max = min + 1;
    return {
      label: t.label.trim() || key,
      unit: t.unit.trim(),
      scale: num(t.scale, 1),
      offset: num(t.offset, 0),
      decimals: Math.max(0, Math.min(4, Math.round(num(t.decimals, 0)))),
      min,
      max,
    };
  };

  const set = (key, patch) =>
    setStore((s) => ({ ...s, [key]: { ...DEFAULT, ...(s[key] || {}), ...patch } }));

  const reset = (key) =>
    setStore((s) => { const c = { ...s }; delete c[key]; return c; });

  // raw PLC value -> engineering value (e.g. 253 -> 25.3)
  const convert = (key, raw) => { const t = get(key); return raw * t.scale + t.offset; };
  const format = (key, raw) => convert(key, raw).toFixed(get(key).decimals);

  return { get, getRaw, set, reset, convert, format };
}
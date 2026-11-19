import { useEffect, useRef, useState } from "react";
import { API } from "../config";

/* Output control session: PIN unlock -> token kept in memory only (never saved).
   The backend locks it again after 5 minutes without use; we mirror that here. */
export function useControl() {
  const [unlocked, setUnlocked] = useState(false);
  const token = useRef("");
  const timer = useRef(null);
  const idleMs = useRef(300000);

  const lockLocal = () => {
    clearTimeout(timer.current);
    token.current = "";
    setUnlocked(false);
  };
  const arm = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(lockLocal, idleMs.current);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const detail = async (r, fallback) => {
    try {
      const j = await r.json();
      return typeof j.detail === "string" ? j.detail : fallback;
    } catch { return fallback; }
  };

  const unlock = async (pin) => {
    try {
      const r = await fetch(`${API}/control/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!r.ok) return { ok: false, error: await detail(r, "Could not unlock.") };
      const j = await r.json();
      token.current = j.token;
      idleMs.current = (j.idle_seconds || 300) * 1000;
      setUnlocked(true);
      arm();
      return { ok: true };
    } catch {
      return { ok: false, error: "Cannot reach the backend." };
    }
  };

  const lock = async () => {
    const t = token.current;
    lockLocal();
    try { await fetch(`${API}/control/lock`, { method: "POST", headers: { "X-Control-Token": t } }); } catch {}
  };

  const write = async (name, value) => {
    try {
      const r = await fetch(`${API}/output`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Control-Token": token.current },
        body: JSON.stringify({ name, value }),
      });
      if (r.status === 401) lockLocal();
      if (!r.ok) return { ok: false, error: await detail(r, "Write failed.") };
      arm();
      return { ok: true };
    } catch {
      return { ok: false, error: "Cannot reach the backend." };
    }
  };

  return { unlocked, unlock, lock, write };
}
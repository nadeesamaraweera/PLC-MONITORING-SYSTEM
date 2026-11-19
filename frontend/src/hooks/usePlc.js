import { useEffect, useRef, useState } from "react";
import { API, SETTINGS_KEY, RECONNECT_MS } from "../config";

const loadSaved = () => {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
};

/* PLC connection: settings, live data, connect / disconnect, auto-reconnect */
export function usePlc(addLog) {
  const [saved] = useState(loadSaved); // settings saved from last time (read once)

  const [models, setModels] = useState([]);
  const [ports, setPorts] = useState([]);
  const [model, setModel] = useState(saved.model || "");
  const [port, setPort] = useState(saved.port || "");
  const [baud, setBaud] = useState(saved.baud || 9600);
  const [parity, setParity] = useState(saved.parity || "N");
  const [slave, setSlave] = useState(saved.slave || 1);
  const [auto, setAuto] = useState(!!saved.auto); // auto-reconnect on/off
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("Plug in the PLC cable, then select a port.");
  const prevY = useRef({});
  const connectedRef = useRef(false);

  const loadPorts = () =>
    fetch(`${API}/ports`)
      .then((r) => r.json())
      .then((p) => {
        setPorts(p);
        setPort((cur) => cur || (p[0] ? p[0].port : ""));
      })
      .catch(() => setMsg("The Python backend is not running. Start it with: python -m uvicorn main:app --port 8000"));

  const loadModels = () =>
    fetch(`${API}/models`)
      .then((r) => r.json())
      .then((m) => {
        setModels(m);
        // keep the saved model / baud / parity if there is one
        if (m[0] && !saved.model) { setModel(m[0].id); setBaud(m[0].baud); setParity(m[0].parity); }
      })
      .catch(() => {});

  const onModel = (id) => {
    setModel(id);
    const m = models.find((x) => x.id === id);
    if (m) { setBaud(m.baud); setParity(m.parity); }
  };

  // silent = true when called by the auto-reconnect timer (no error messages)
  const connect = async (silent = false) => {
    if (!silent) setMsg("");
    try {
      const r = await fetch(`${API}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, port, baud: Number(baud), parity, slave: Number(slave) }),
      });
      if (!r.ok) {
        if (!silent) setMsg((await r.json()).detail);
      } else if (silent) {
        addLog(`${port} auto-reconnected`);
      } else {
        setMsg("Connected.");
        addLog(`${port} connected`);
        setAuto(true);
      }
    } catch {
      if (!silent) setMsg("Cannot reach the backend.");
    }
  };

  const disconnect = async () => {
    setAuto(false); // user disconnected on purpose, so stop auto-reconnect
    try {
      await fetch(`${API}/disconnect`, { method: "POST" });
      addLog("Disconnected");
      setMsg("Disconnected.");
    } catch {
      setMsg("Cannot reach the backend.");
    }
  };

  // first load
  useEffect(() => {
    loadModels();
    loadPorts();
  }, []);

  // save settings every time they change
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ model, port, baud, parity, slave, auto }));
    } catch {}
  }, [model, port, baud, parity, slave, auto]);

  // poll live data every second
  useEffect(() => {
    const t = setInterval(() => {
      fetch(`${API}/data`).then((r) => r.json()).then(setData).catch(() => setData(null)); // backend down -> show disconnected
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // log output changes
  useEffect(() => {
    if (!data) return;
    Object.entries(data.y).forEach(([k, v]) => {
      if (k in prevY.current && prevY.current[k] !== v) addLog(`${k} ${v ? "ON" : "OFF"}`);
    });
    prevY.current = { ...data.y };
  }, [data]);

  const connected = !!data?.connected;
  connectedRef.current = connected;
  const modelName = models.find((m) => m.id === model)?.name ?? "";

  // when the backend comes back, reload the model + port lists and clear the old error
  useEffect(() => {
    if (!connected) return;
    if (models.length === 0) loadModels();
    loadPorts();
    setMsg((m) => (m.startsWith("The Python backend") ? "Connected." : m));
  }, [connected]);

  // auto-reconnect: if it was connected before and the link drops, retry every 5 s
  useEffect(() => {
    if (!auto || !model || !port) return;
    const t = setInterval(() => {
      if (!connectedRef.current) connect(true);
    }, RECONNECT_MS);
    return () => clearInterval(t);
  }, [auto, model, port, baud, parity, slave]);

  return {
    models, ports, model, port, baud, parity, slave, auto, data, msg,
    connected, modelName,
    setPort, setBaud, setParity, setSlave,
    onModel, loadPorts, connect, disconnect,
  };
}
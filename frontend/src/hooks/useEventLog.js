import { useCallback, useState } from "react";

/* Event log shown at the bottom of the page (last 30 events) */
export function useEventLog() {
  const [log, setLog] = useState([]);
  const addLog = useCallback(
    (text) => setLog((l) => [{ t: new Date().toLocaleTimeString("en-GB"), text }, ...l].slice(0, 30)),
    []
  );
  return { log, addLog };
}
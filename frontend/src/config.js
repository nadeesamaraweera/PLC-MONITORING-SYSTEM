// Works from this PC and from other PCs on the network (backend on port 8000)
export const API = `http://${window.location.hostname || "localhost"}:8000/api`;

export const RING = 339.3;           // circumference of the gauge circle (r = 54)
export const GAUGE_MAX = 120;        // value that fills the ring completely
export const LOGO_SRC = "/logo.png"; // file in the public folder
export const SETTINGS_KEY = "plc_settings";
export const RECONNECT_MS = 5000;    // auto-reconnect: try every 5 seconds

// fonts (used inside the inline styles)
export const FONT = '"Barlow", "Noto Sans Sinhala", "Segoe UI", system-ui, sans-serif';
export const NUM = { fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif', fontVariantNumeric: "tabular-nums" };
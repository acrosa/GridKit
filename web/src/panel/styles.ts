export const STYLE_ID = "gridkit-styles";

/**
 * Scoped, injected once. Everything lives under `.gk-root` and is reset
 * explicitly so host-page styles (global `button {}` rules etc.) can't leak in.
 */
export const PANEL_CSS = `
.gk-root, .gk-root * { box-sizing: border-box; }
.gk-root {
  --gk-bg: rgba(250, 250, 252, 0.86);
  --gk-bg-solid: #fafafc;
  --gk-fg: #1c1c1e;
  --gk-fg-secondary: rgba(60, 60, 67, 0.6);
  --gk-border: rgba(0, 0, 0, 0.12);
  --gk-chip: rgba(0, 0, 0, 0.06);
  --gk-accent: #0a7aff;
  --gk-accent-soft: rgba(10, 122, 255, 0.18);
  --gk-shadow: 0 6px 24px rgba(0, 0, 0, 0.22);
  position: fixed; inset: 0; pointer-events: none;
  font: 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
  color: var(--gk-fg); -webkit-font-smoothing: antialiased; text-align: left; direction: ltr;
}
@media (prefers-color-scheme: dark) {
  .gk-root {
    --gk-bg: rgba(30, 30, 34, 0.86); --gk-bg-solid: #1e1e22; --gk-fg: #f2f2f7;
    --gk-fg-secondary: rgba(235, 235, 245, 0.6); --gk-border: rgba(255, 255, 255, 0.14);
    --gk-chip: rgba(255, 255, 255, 0.08); --gk-accent: #409cff; --gk-accent-soft: rgba(64, 156, 255, 0.24);
    --gk-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
  }
}
.gk-canvas { position: absolute; top: 0; left: 0; }
.gk-control { position: absolute; right: 12px; bottom: 40px; pointer-events: auto; touch-action: none; }
.gk-pill {
  display: inline-flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 999px;
  background: var(--gk-bg); border: 1px solid var(--gk-border); box-shadow: var(--gk-shadow);
  backdrop-filter: blur(14px) saturate(160%); -webkit-backdrop-filter: blur(14px) saturate(160%);
  cursor: grab; user-select: none; -webkit-user-select: none;
}
.gk-pill.gk-dragging, .gk-header.gk-dragging { cursor: grabbing; }
.gk-btn {
  appearance: none; -webkit-appearance: none; margin: 0; padding: 0; border: 0; background: none;
  font: inherit; color: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
  line-height: 1; border-radius: 6px;
}
.gk-btn:focus-visible { outline: 2px solid var(--gk-accent); outline-offset: 2px; }
.gk-btn.gk-on { color: var(--gk-accent); }
.gk-pill .gk-label { font-weight: 600; font-size: 11px; }
.gk-panel {
  width: 300px; max-width: calc(100vw - 24px); border-radius: 14px; overflow: hidden;
  background: var(--gk-bg); border: 1px solid var(--gk-border); box-shadow: var(--gk-shadow);
  backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%);
  display: flex; flex-direction: column;
}
.gk-header {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--gk-border);
  cursor: grab; user-select: none; -webkit-user-select: none; font-weight: 600; font-size: 13px;
}
.gk-header .gk-spacer { flex: 1; }
.gk-header .gk-btn { color: var(--gk-fg-secondary); }
.gk-body { overflow-y: auto; max-height: min(420px, calc(100vh - 140px)); padding: 12px; display: flex; flex-direction: column; gap: 12px; }
.gk-section { display: flex; flex-direction: column; gap: 6px; }
.gk-title { font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gk-fg-secondary); }
.gk-title .gk-hint { font-weight: 400; letter-spacing: 0; text-transform: none; }
.gk-divider { height: 1px; background: var(--gk-border); }
.gk-presets { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin; }
.gk-preset { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 0 0 auto; width: 76px; }
.gk-preset .gk-thumb { width: 72px; height: 48px; border-radius: 6px; overflow: hidden; background: var(--gk-chip); border: 1px solid var(--gk-border); }
.gk-preset.gk-on .gk-thumb { border: 2px solid var(--gk-accent); }
.gk-preset .gk-name { font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 76px; text-align: center; }
.gk-preset.gk-on .gk-name { font-weight: 600; }
.gk-chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); gap: 6px; }
.gk-chip {
  justify-content: center; padding: 5px 8px; border-radius: 999px; font-size: 10px; font-weight: 500;
  background: var(--gk-chip); border: 1px solid var(--gk-border); width: 100%;
}
.gk-chip.gk-on { background: var(--gk-accent-soft); border-color: var(--gk-accent); }
.gk-row { display: flex; align-items: center; gap: 8px; }
.gk-row .gk-key { width: 60px; flex: 0 0 60px; font-size: 11px; }
.gk-row .gk-val { width: 36px; flex: 0 0 36px; text-align: right; font-variant-numeric: tabular-nums; font-size: 11px; }
.gk-range { flex: 1; min-width: 0; margin: 0; accent-color: var(--gk-accent); }
.gk-stepper { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; }
.gk-stepper .gk-steps { display: inline-flex; border: 1px solid var(--gk-border); border-radius: 7px; overflow: hidden; }
.gk-stepper .gk-steps .gk-btn { padding: 3px 10px; border-radius: 0; background: var(--gk-chip); font-weight: 600; }
.gk-stepper .gk-steps .gk-btn + .gk-btn { border-left: 1px solid var(--gk-border); }
.gk-swatches { display: flex; align-items: center; gap: 8px; }
.gk-swatch { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--gk-border); padding: 0; }
.gk-swatch.gk-on { border-color: var(--gk-fg); }
.gk-color { width: 26px; height: 24px; padding: 0; border: 1px solid var(--gk-border); border-radius: 6px; background: none; cursor: pointer; }
.gk-switch { display: flex; align-items: center; justify-content: space-between; font-size: 11px; }
.gk-toggle { position: relative; width: 34px; height: 20px; border-radius: 999px; background: var(--gk-chip); border: 1px solid var(--gk-border); transition: background 0.15s; }
.gk-toggle::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.3); transition: transform 0.15s; }
.gk-toggle.gk-on { background: var(--gk-accent); border-color: var(--gk-accent); }
.gk-toggle.gk-on::after { transform: translateX(14px); }
.gk-segmented { display: inline-flex; border: 1px solid var(--gk-border); border-radius: 7px; overflow: hidden; }
.gk-segmented .gk-btn { padding: 4px 10px; border-radius: 0; font-size: 10px; background: var(--gk-chip); }
.gk-segmented .gk-btn + .gk-btn { border-left: 1px solid var(--gk-border); }
.gk-segmented .gk-btn.gk-on { background: var(--gk-accent-soft); color: var(--gk-accent); font-weight: 600; }
.gk-scale { display: flex; align-items: baseline; gap: 10px; overflow-x: auto; padding-bottom: 4px; }
.gk-scale .gk-step { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 0 0 auto; }
.gk-scale .gk-size { font-size: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--gk-fg-secondary); }
.gk-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.gk-action { padding: 5px 10px; border-radius: 7px; background: var(--gk-chip); border: 1px solid var(--gk-border); font-size: 11px; }
.gk-action:hover { background: var(--gk-accent-soft); }
.gk-notes { font-size: 10px; color: var(--gk-fg-secondary); }
.gk-kbd { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; padding: 1px 4px; border: 1px solid var(--gk-border); border-radius: 4px; background: var(--gk-chip); }
.gk-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
`;

let injected = false;

/** Injects the panel stylesheet once per document. */
export function injectStyles(doc: Document = document): void {
  if (injected && doc.getElementById(STYLE_ID)) return;
  if (doc.getElementById(STYLE_ID)) {
    injected = true;
    return;
  }
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = PANEL_CSS;
  doc.head.appendChild(style);
  injected = true;
}

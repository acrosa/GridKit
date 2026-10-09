// GridKit grid-align: draws the resolved grid and numbered audit findings on
// top of the current page so a screenshot shows exactly what audit_frames.py
// reported. Evaluate as an expression; it yields a function:
//
//   (annotate)({ geometry, findings }, { baseline: true })
//
// Call it again with `null` to remove the annotation layer.
((audit, options = {}) => {
  const ID = "gridkit-audit-annotations";
  document.getElementById(ID)?.remove();
  if (!audit) return 0;

  const { geometry: g, findings = [] } = audit;
  const doc = document.documentElement;
  const width = doc.clientWidth;
  const height = Math.max(doc.scrollHeight, window.innerHeight);
  const COLORS = { error: "#ff2d55", warn: "#ff9500", info: "#0a84ff" };

  const root = document.createElement("div");
  root.id = ID;
  root.setAttribute("data-gridkit", "");
  Object.assign(root.style, {
    position: "absolute", left: "0", top: "0", width: `${width}px`, height: `${height}px`,
    pointerEvents: "none", zIndex: "2147483646", font: "600 11px/1.2 ui-monospace, Menlo, monospace",
  });

  const box = (x, y, w, h, css) => {
    const d = document.createElement("div");
    Object.assign(d.style, { position: "absolute", left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, boxSizing: "border-box" }, css);
    root.appendChild(d);
    return d;
  };

  const cols = g.columns;
  if (cols) {
    box(0, 0, cols.contentStart, height, { background: "rgba(255,0,140,0.06)" });
    box(cols.contentEnd, 0, width - cols.contentEnd, height, { background: "rgba(255,0,140,0.06)" });
    cols.starts.forEach((x, i) => {
      box(x, 0, cols.columnWidth, height, {
        background: "rgba(255,0,140,0.08)",
        borderLeft: "1px solid rgba(255,0,140,0.55)",
        borderRight: "1px solid rgba(255,0,140,0.55)",
      });
      const tag = box(x + 2, 2 + window.scrollY, 40, 14, { color: "rgba(255,0,140,0.9)" });
      tag.textContent = String(i + 1);
    });
  }
  const rows = g.rows;
  if (rows) {
    rows.starts.forEach((y, i) => {
      box(0, y, width, rows.rowHeight, {
        background: "rgba(255,0,140,0.05)",
        borderTop: "1px solid rgba(255,0,140,0.45)",
        borderBottom: "1px solid rgba(255,0,140,0.45)",
      });
      const tag = box(2, y + 2, 40, 14, { color: "rgba(255,0,140,0.9)" });
      tag.textContent = `R${i + 1}`;
    });
  }
  if (g.baseline && options.baseline !== false) {
    // Horizontal baseline grid; every Nth line (the "beat") drawn stronger.
    const r = g.baseline.rhythm;
    const n = g.baseline.emphasisEvery;
    const line = (alpha, period) => `repeating-linear-gradient(to bottom, rgba(0,190,255,${alpha}) 0, rgba(0,190,255,${alpha}) 1px, transparent 1px, transparent ${period}px)`;
    box(0, g.baseline.firstLine, width, height - g.baseline.firstLine, {
      backgroundImage: n ? `${line(0.55, r * n)}, ${line(0.22, r)}` : line(0.22, r),
    });
  }
  for (const k of g.keyLines || []) {
    const css = { borderColor: "rgba(0,200,120,0.9)", borderStyle: "dashed", borderWidth: "0" };
    if (k.axis === "horizontal") box(0, k.position, width, 1, { ...css, borderTopWidth: "1px" });
    else box(k.position, 0, 1, height, { ...css, borderLeftWidth: "1px" });
  }

  // Where off-grid text actually sits: a solid line on its measured baseline.
  for (const f of findings) {
    if (f.baselineY == null || !f.rect) continue;
    box(f.rect.x, f.baselineY, f.rect.w, 2, { background: COLORS[f.severity] || COLORS.info });
  }

  // One box per element; its badge lists every finding number on it.
  const RANK = { error: 0, warn: 1, info: 2 };
  const byRect = new Map();
  for (const f of findings) {
    if (!f.rect) continue;
    const { x, y, w, h } = f.rect;
    const key = [x, y, w, h].map((v) => Math.round(v)).join(",");
    const entry = byRect.get(key) || { rect: f.rect, ns: [], severity: f.severity };
    entry.ns.push(f.n);
    if (RANK[f.severity] < RANK[entry.severity]) entry.severity = f.severity;
    byRect.set(key, entry);
  }
  const placed = [];
  for (const { rect, ns, severity } of byRect.values()) {
    const color = COLORS[severity] || COLORS.info;
    const { x, y, w, h } = rect;
    box(x, y, Math.max(w, 2), Math.max(h, 2), { border: `2px solid ${color}`, background: `${color}14` });
    // Nudge badges right until they stop colliding with earlier ones.
    const label = ns.join("·");
    const bw = 10 + label.length * 7;
    let bx = x;
    const by = Math.max(y - 16, 0);
    while (placed.some((p) => Math.abs(p.y - by) < 16 && bx < p.x + p.w + 2 && bx + bw > p.x)) bx += 4;
    placed.push({ x: bx, y: by, w: bw });
    const badge = box(bx, by, bw, 16, { padding: "1px 5px", background: color, color: "#fff", borderRadius: "3px", whiteSpace: "nowrap" });
    badge.textContent = label;
  }

  // Child of <html> so it is positioned against the document origin, not a
  // (possibly margined or transformed) <body>.
  document.documentElement.appendChild(root);
  return findings.length;
});

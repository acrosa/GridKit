// GridKit grid-align: collects element frames + computed spacing from the
// current page, in the frames format audit_frames.py reads.
//
// Evaluate the whole file as an expression in the page (Playwright
// `page.evaluate(source)`, or paste into a browser JS tool). It returns a
// plain JSON-serializable object. Coordinates are CSS px relative to the
// document (x from the left edge, y from the top of the page).
(() => {
  const MAX_ELEMENTS = 2500;
  const doc = document.documentElement;
  const vw = doc.clientWidth; // excludes the vertical scrollbar
  const vh = window.innerHeight;
  const sx = window.scrollX;
  const sy = window.scrollY;

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "LINK", "META", "HEAD", "BR", "WBR", "SOURCE", "TRACK"]);
  const MEDIA_TAGS = new Set(["IMG", "VIDEO", "CANVAS", "SVG", "PICTURE", "IFRAME", "svg"]);
  const CONTROL_TAGS = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "LABEL", "SUMMARY"]);

  const px = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  };

  function kindOf(el) {
    if (MEDIA_TAGS.has(el.tagName)) return "media";
    const role = el.getAttribute("role");
    if (CONTROL_TAGS.has(el.tagName) || role === "button" || role === "link" || role === "tab") return "control";
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim()) return "text";
    }
    return "container";
  }

  function selectorOf(el) {
    const parts = [];
    let cur = el;
    for (let depth = 0; cur && cur !== document.body && depth < 3; depth++) {
      let s = cur.tagName.toLowerCase();
      if (cur.id) {
        parts.unshift(`${s}#${cur.id}`);
        break;
      }
      const cls = [...cur.classList].filter((c) => !/^(css|sc|jsx|svelte|astro)-|^_|[0-9a-f]{6,}/i.test(c)).slice(0, 3);
      if (cls.length) s += "." + cls.join(".");
      parts.unshift(s);
      cur = cur.parentElement;
    }
    return parts.join(" > ");
  }

  // React dev builds: nearest named component, plus its source location when
  // the build still attaches _debugSource (React ≤ 18).
  function componentOf(el) {
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
    if (!key) return null;
    let fiber = el[key];
    let source = null;
    for (let i = 0; fiber && i < 40; i++, fiber = fiber.return) {
      if (!source && fiber._debugSource) source = `${fiber._debugSource.fileName}:${fiber._debugSource.lineNumber}`;
      const t = fiber.type;
      if (typeof t === "function" || (t && typeof t === "object" && (t.render || t.type))) {
        const name = t.displayName || t.name || (t.render && (t.render.displayName || t.render.name)) || (t.type && (t.type.displayName || t.type.name));
        if (name) return source ? `${name} (${source})` : name;
      }
    }
    return null;
  }

  function label(el, kind) {
    const aria = el.getAttribute("aria-label") || el.getAttribute("alt") || el.getAttribute("title");
    if (aria) return aria.slice(0, 48);
    if (kind === "text" || kind === "control") {
      const t = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
      if (t) return t.slice(0, 48);
    }
    return null;
  }

  const elements = [];
  const indexOf = new Map();

  function visit(el, parentIndex) {
    if (elements.length >= MAX_ELEMENTS) return;
    if (SKIP_TAGS.has(el.tagName) || el.hasAttribute("data-gridkit") || el.closest("[data-gridkit]")) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none") return;

    const r = el.getBoundingClientRect();
    const visible = r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0;
    let myIndex = parentIndex;

    if (visible) {
      const parent = parentIndex != null ? elements[parentIndex] : null;
      const x = r.left + sx;
      const y = r.top + sy;
      // Skip pure wrappers whose box is identical to their parent's.
      const sameAsParent =
        parent && Math.abs(parent.x - x) < 0.5 && Math.abs(parent.y - y) < 0.5 && Math.abs(parent.w - r.width) < 0.5 && Math.abs(parent.h - r.height) < 0.5;
      if (!sameAsParent) {
        const kind = kindOf(el);
        const item = {
          id: elements.length,
          parent: parentIndex,
          kind,
          tag: el.tagName.toLowerCase(),
          selector: selectorOf(el),
          label: label(el, kind),
          component: componentOf(el),
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          w: Math.round(r.width * 100) / 100,
          h: Math.round(r.height * 100) / 100,
          style: {
            display: cs.display,
            position: cs.position,
            paddingTop: px(cs.paddingTop),
            paddingRight: px(cs.paddingRight),
            paddingBottom: px(cs.paddingBottom),
            paddingLeft: px(cs.paddingLeft),
            marginTop: px(cs.marginTop),
            marginRight: px(cs.marginRight),
            marginBottom: px(cs.marginBottom),
            marginLeft: px(cs.marginLeft),
            rowGap: cs.display.includes("flex") || cs.display.includes("grid") ? px(cs.rowGap) : null,
            columnGap: cs.display.includes("flex") || cs.display.includes("grid") ? px(cs.columnGap) : null,
            // Has a visible box (card, panel, button) whose padding is legitimately inside the grid.
            visual:
              (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") ||
              cs.backgroundImage !== "none" ||
              cs.boxShadow !== "none" ||
              ["Top", "Right", "Bottom", "Left"].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== "none"),
            fontSize: kind === "text" ? px(cs.fontSize) : null,
            lineHeight: kind === "text" ? px(cs.lineHeight) : null, // null when "normal"
          },
        };
        indexOf.set(el, item.id);
        elements.push(item);
        myIndex = item.id;
      }
    }
    for (const child of el.children) visit(child, myIndex);
    if (el.shadowRoot) for (const child of el.shadowRoot.children) visit(child, myIndex);
  }

  visit(document.body, null);

  return {
    platform: "web",
    url: location.href,
    viewport: { width: vw, height: vh, scale: window.devicePixelRatio || 1 },
    safeArea: { top: 0, leading: 0, bottom: 0, trailing: 0 },
    page: { scrollWidth: doc.scrollWidth, scrollHeight: doc.scrollHeight },
    truncated: elements.length >= MAX_ELEMENTS,
    elements,
  };
})();

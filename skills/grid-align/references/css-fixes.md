# CSS, Tailwind and CSS-in-JS fix playbook

Check what the project already uses (plain CSS/SCSS, CSS modules, Tailwind v3 or v4, styled-components/emotion, MUI/Chakra theme, Bootstrap) and fix within that system. `assets/grid.css` is a self-contained template for plain-CSS projects. It is verified clean against the audit at 390 and 1280 px.

## 1. Tokens

**Plain CSS / SCSS / CSS modules.** Custom properties on `:root`, with the compact variant as the default and the regular variant inside the breakpoint media query:

```css
:root { --grid-columns: 4; --grid-gutter: 16px; --grid-margin: 16px; --rhythm: 8px; --space-2: 8px; --space-4: 16px; }
@media (min-width: 768px) { :root { --grid-columns: 12; --grid-gutter: 16px; --grid-margin: 24px; } }
```

**Tailwind v4.** Tokens live in CSS:

```css
@theme {
  --spacing: 4px;            /* p-4 = 16px. Use 8px to make every step land on an 8-pt scale. */
  --breakpoint-md: 48rem;    /* = spec.compactBreakpoint (768) */
  --container-content: 75rem;/* max-w-content */
}
```

Changing `--spacing` rescales every utility, so a site-wide change is a design decision to confirm first. The usual migration keeps 4px and replaces off-scale steps (`p-3` → `p-4`, `gap-5` → `gap-4` or `gap-6`) and arbitrary values (`p-[13px]`). `scan_spacing.py` lists them with the variant prefix (`md:px-[30px]`).

**Tailwind v3.** `theme.extend.spacing`, `theme.screens`, and the `container` options (`center: true`, `padding: { DEFAULT: '1rem', md: '1.5rem' }`) in `tailwind.config.*`. Restrict the scale by *replacing* `theme.spacing` (not extending it) only if the user wants enforcement.

**CSS-in-JS.** Put values in the theme object (`theme.space`, styled-system arrays, MUI `createTheme({ spacing: 8 })`, then `theme.spacing(2)` = 16). Replace template-literal px values with theme lookups.

**Bootstrap.** Change `$grid-gutter-width`, `$container-padding-x`, `$grid-breakpoints` and `$container-max-widths` in the SCSS overrides, not per-component.

## 2. Page margins, max width, safe areas

```css
.container {
  width: 100%;
  max-width: calc(var(--grid-max) + 2 * var(--grid-margin));
  margin-inline: auto;
  padding-inline: max(var(--grid-margin), env(safe-area-inset-left)) max(var(--grid-margin), env(safe-area-inset-right));
}
```

- `env(safe-area-inset-*)` needs `<meta name="viewport" content="…, viewport-fit=cover">` to be non-zero.
- **Doubled margin** (`content-edge`): look for a section or wrapper that adds its own `padding-inline` inside `.container`. Keep exactly one owner of the outer margin.
- **Full-bleed inside centered content:** use the named-lines layout (`.bleed-layout` in `grid.css`) rather than negative margins or `width: 100vw`. `100vw` includes the scrollbar and causes `overflow` findings.
- **`overflow` findings:** look for `width: 100vw`, fixed pixel widths, flex/grid children missing `min-width: 0` (use `minmax(0, 1fr)` for tracks), long URLs (`overflow-wrap: anywhere`), and transforms. Don't paper over them with `overflow-x: hidden` on `body`, which hides the bug and breaks `position: sticky`.

## 3. Columns and spans

```css
.grid { display: grid; grid-template-columns: repeat(var(--grid-columns), minmax(0, 1fr)); column-gap: var(--grid-gutter); }
.card { grid-column: span 4; }
@media (max-width: 767.98px) { .card { grid-column: 1 / -1; } }
```

- A span larger than the column count creates implicit tracks and breaks the grid. Give each breakpoint its own span, or use `1 / -1` for full width.
- Nested components that must stay on the page columns: `grid-template-columns: subgrid` (all evergreen browsers) instead of re-declaring a grid with its own gaps.
- Flexbox rows of cards (`display: flex; gap: 13px; flex: 1`) align to columns only by accident. Convert them to the grid, or at least set `gap: var(--grid-gutter)` and `flex-basis` from spans: `calc((100% - (N - 1) * gutter) / N * n + (n - 1) * gutter)`.
- Tailwind: `grid grid-cols-4 md:grid-cols-12 gap-x-4`, with `col-span-4 md:col-span-4` and `col-span-full`. Replace `w-[343px]` and `basis-1/3`-with-gap mismatches by `col-span-*`.
- Component-level responsiveness: `container-type: inline-size` + `@container (min-width: 40rem)` when a component appears in containers of different widths. Keep the page grid on media queries matching the spec's breakpoints.

## 4. Vertical rhythm and type

- `line-height` as a rhythm multiple in absolute units, e.g. `line-height: calc(var(--rhythm) * 3)`, or snap with `round(up, 1.25em, var(--rhythm))` (Chrome 125+, Safari 15.4+, Firefox 118+; guard with `@supports`). Unitless line heights produce sub-pixel `type` findings at most sizes.
- Remove the browser's `em` defaults on headings and paragraphs (`h1 { margin: 0.67em 0 }` gives 21.44px). Set `margin-block` from the scale, ideally one direction only (`margin-block: 0 var(--space-4)`), or use a flex column `gap` / `.stack > * + *` pattern so margins never collapse unpredictably.
- `text-box: trim-both cap alphabetic` (Chrome 133+, Safari 18.2+) trims half-leading, so a text block's box starts at the cap height. It's a progressive enhancement for putting text precisely on key lines.
- Font sizes: map stray sizes to the type scale, and keep fluid type (`clamp()`) endpoints on scale values.
- Tailwind: `leading-6` (24px), or a token (`leading-(--line-3)` in v4, `leading-[var(--line-3)]` in v3) instead of `leading-snug` where the rhythm matters, and `space-y-4`/`gap-y-4` on the scale.

## 5. Key lines

A header height, sidebar width or hangline is a token: `--header-h: 64px`. Use it in `grid-template-rows`/`grid-template-columns`, `scroll-padding-top` (for anchored scrolling under a sticky header), and `top:` of sticky elements. Don't use magic `margin-top` values that only work at one viewport.

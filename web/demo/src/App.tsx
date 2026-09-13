import { GridKit, GridKitOverlay, eightPointRhythm, swissTwelveColumn, useGridKit } from "gridkit-react";

const cards = [
  ["Columns", "12 columns on desktop, 4 on phones. Check that cards land on column edges and gutters match."],
  ["Baseline rhythm", "Every line of text here sits on a 24 px line-height, i.e. three beats of the 8 px rhythm."],
  ["Key lines", "The App Shell preset marks the 64 px header; open the panel and switch presets to see it."],
  ["Modules", "Modular presets shade the cells your tiles should fill — handy for dashboards and galleries."],
  ["Difference blend", "Turn it on in Appearance to keep lines visible over dark hero images and light text alike."],
  ["Shared JSON", "Export the configuration and drop the same file into the iOS app — one grid, both platforms."],
];

function Toolbar() {
  const { isVisible, toggle, apply, appliedPresetID } = useGridKit();
  return (
    <div className="actions">
      <button className="primary" onClick={toggle}>
        {isVisible ? "Hide grid" : "Show grid"}
      </button>
      <button className="secondary" onClick={() => apply(swissTwelveColumn)} disabled={appliedPresetID === swissTwelveColumn.id}>
        Swiss 12-column
      </button>
      <button className="secondary" onClick={() => apply(eightPointRhythm)} disabled={appliedPresetID === eightPointRhythm.id}>
        8 px rhythm
      </button>
      <button
        className="secondary"
        onClick={() => {
          void GridKit.shared.load("/brand-grid.json");
          GridKit.shared.show();
        }}
      >
        Load brand-grid.json
      </button>
    </div>
  );
}

export function App() {
  return (
    <>
      <header className="site">
        <span className="brand">Acme Design</span>
        <nav>
          <span>Work</span>
          <span>Studio</span>
          <span>Journal</span>
          <span>Contact</span>
        </nav>
      </header>
      <main>
        <section className="hero">
          <h1>A sample site with GridKit riding on top.</h1>
          <p>
            Press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> or tap the pill in the corner to toggle the grid. Tap “GridKit” on the
            pill to open the control panel and browse presets.
          </p>
          <Toolbar />
        </section>

        <section className="grid">
          {cards.map(([title, body]) => (
            <article className="card" key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </section>

        <section className="section">
          <h2>Why a grid overlay?</h2>
          <p>
            Designers hand over layouts built on a column system and a baseline rhythm. Once the page is live, the only way to check
            the implementation honours that system is to draw the system over the real thing. GridKit does exactly that — at device
            pixel resolution, on top of whatever is rendering right now, without touching your markup.
          </p>
          <div className="chips">
            {["12-column", "8 px rhythm", "Key lines", "Modules", "Safe area", "JSON export"].map((c) => (
              <span className="chip" key={c}>
                {c}
              </span>
            ))}
          </div>
        </section>

        <section className="grid section">
          <article className="card wide">
            <h3>Wide card (8 columns)</h3>
            <p>Switch the panel’s anchor to “Document” to make the baseline grid scroll with this content instead of the viewport.</p>
          </article>
          <article className="card narrow">
            <h3>Narrow card (4 columns)</h3>
            <p>The margins layer tints everything outside the column zones, so misaligned edges stand out immediately.</p>
          </article>
        </section>
      </main>
      <footer className="site">Built with gridkit-react — a development-time overlay. It renders nothing in production builds.</footer>

      {/* One line at the app root. Renders nothing in production builds. */}
      <GridKitOverlay activation={["floatingButton", "keyboard"]} initialPreset={swissTwelveColumn} safeArea={{ top: 64 }} />
    </>
  );
}

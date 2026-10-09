#!/usr/bin/env node
// GridKit grid-align — web capture + audit driver.
//
// For every route × target width in the spec: loads the page in headless
// Chromium, collects element frames (collect_frames.js), audits them
// (audit_frames.py), then saves a raw screenshot and an annotated one with
// the grid and numbered findings drawn on top (annotate_page.js).
//
//   node web_capture.mjs --spec .gridkit/spec.json [--url http://localhost:5173]
//        [--routes /,/pricing] [--widths 390,1440] [--out .gridkit/audit] [--full-page]
//
// Needs the `playwright` package: resolved from the project first, then from
// $PLAYWRIGHT_DIR (any folder where `npm i playwright` was run).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { spec: ".gridkit/spec.json", out: ".gridkit/audit", fullPage: false, wait: 500 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--spec") args.spec = next();
    else if (a === "--url") args.url = next();
    else if (a === "--routes") args.routes = next().split(",");
    else if (a === "--widths") args.widths = next().split(",").map(Number);
    else if (a === "--out") args.out = next();
    else if (a === "--full-page") args.fullPage = true;
    else if (a === "--wait") args.wait = Number(next());
    else if (a === "--help" || a === "-h") {
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 15).join("\n"));
      process.exit(0);
    }
  }
  return args;
}

async function loadPlaywright() {
  const roots = [process.cwd(), process.env.PLAYWRIGHT_DIR].filter(Boolean);
  for (const root of roots) {
    try {
      const require = createRequire(path.join(path.resolve(root), "noop.js"));
      return require("playwright");
    } catch {}
  }
  console.error(
    "Could not load `playwright`. Either add it to the project (npm i -D playwright) or install it\n" +
      "somewhere else and point PLAYWRIGHT_DIR at that folder:\n" +
      "  npm i --prefix ~/.cache/gridkit-align playwright && npx --prefix ~/.cache/gridkit-align playwright install chromium\n" +
      "  PLAYWRIGHT_DIR=~/.cache/gridkit-align node web_capture.mjs ...",
  );
  process.exit(2);
}

function slug(route) {
  const s = route.replace(/^\/+|\/+$/g, "").replace(/[^\w-]+/g, "-");
  return s || "home";
}

const args = parseArgs(process.argv.slice(2));
const spec = JSON.parse(readFileSync(args.spec, "utf8"));
const baseURL = args.url || spec.web?.url;
if (!baseURL) {
  console.error("No URL: pass --url or set web.url in the spec.");
  process.exit(2);
}
const routes = args.routes || spec.web?.routes || ["/"];
const targets = args.widths
  ? args.widths.map((w) => ({ name: `${w}`, width: w, height: 900 }))
  : spec.targets?.length
    ? spec.targets
    : [390, 834, 1440].map((w) => ({ name: `${w}`, width: w, height: 900 }));

const collectSource = readFileSync(path.join(HERE, "collect_frames.js"), "utf8");
const annotateSource = readFileSync(path.join(HERE, "annotate_page.js"), "utf8").trim().replace(/;\s*$/, "");

mkdirSync(args.out, { recursive: true });
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const summary = [];

try {
  for (const target of targets) {
    const context = await browser.newContext({
      viewport: { width: target.width, height: target.height || 900 },
      deviceScaleFactor: target.scale || 1,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    for (const route of routes) {
      const name = `${slug(route)}@${target.width}`;
      const url = new URL(route, baseURL).toString();
      await page.goto(url, { waitUntil: "networkidle" }).catch(() => page.goto(url, { waitUntil: "load" }));
      await page.waitForTimeout(args.wait);
      // GridKit's own overlay would show up in screenshots; hide it while capturing.
      await page.addStyleTag({ content: "[data-gridkit]:not(#gridkit-audit-annotations){display:none!important}" });

      const frames = await page.evaluate(collectSource);
      frames.name = name;
      const framesPath = path.join(args.out, `${name}.frames.json`);
      writeFileSync(framesPath, JSON.stringify(frames, null, 2));

      const auditJSON = execFileSync("python3", [path.join(HERE, "audit_frames.py"), "--spec", args.spec, "--format", "json", framesPath], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
      const audit = JSON.parse(auditJSON);
      writeFileSync(path.join(args.out, `${name}.audit.json`), JSON.stringify(audit, null, 2));
      const md = execFileSync("python3", [path.join(HERE, "audit_frames.py"), "--spec", args.spec, "--format", "md", framesPath], { encoding: "utf8" });
      writeFileSync(path.join(args.out, `${name}.audit.md`), md);

      await page.screenshot({ path: path.join(args.out, `${name}.png`), fullPage: args.fullPage });
      await page.evaluate(`(${annotateSource})(${JSON.stringify(audit)})`);
      await page.screenshot({ path: path.join(args.out, `${name}.annotated.png`), fullPage: args.fullPage });

      const counts = audit.findings.reduce((acc, f) => ((acc[f.severity] = (acc[f.severity] || 0) + 1), acc), {});
      summary.push({ name, url, variant: audit.geometry.variant, ...counts });
      console.log(`${name.padEnd(28)} ${audit.geometry.variant.padEnd(8)} errors ${counts.error || 0}  warnings ${counts.warn || 0}  info ${counts.info || 0}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}

writeFileSync(path.join(args.out, "summary.json"), JSON.stringify(summary, null, 2));
console.log(`\nWrote frames, audits and screenshots to ${args.out}/`);

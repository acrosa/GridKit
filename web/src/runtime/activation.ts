import type { GridKit } from "./GridKit";
import { DEFAULT_HOTKEY, type GridKitActivation, type GridKitOptions } from "./types";

export function activationList(options: GridKitOptions): GridKitActivation[] {
  const a = options.activation ?? ["floatingButton", "keyboard"];
  return Array.isArray(a) ? a : [a];
}

interface ParsedHotkey {
  alt: boolean;
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
  mod: boolean;
  code: string | undefined;
  key: string;
}

/** Parses `"alt+shift+g"` / `"mod+g"` into a matcher. Letters/digits match on `event.code` so ⌥ combos on macOS still hit. */
export function parseHotkey(hotkey: string): ParsedHotkey {
  const parts = hotkey
    .toLowerCase()
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  const parsed: ParsedHotkey = { alt: false, shift: false, ctrl: false, meta: false, mod: false, code: undefined, key: "" };
  for (const part of parts) {
    if (part === "alt" || part === "option") parsed.alt = true;
    else if (part === "shift") parsed.shift = true;
    else if (part === "ctrl" || part === "control") parsed.ctrl = true;
    else if (part === "meta" || part === "cmd" || part === "command") parsed.meta = true;
    else if (part === "mod") parsed.mod = true;
    else parsed.key = part;
  }
  if (/^[a-z]$/.test(parsed.key)) parsed.code = `Key${parsed.key.toUpperCase()}`;
  else if (/^[0-9]$/.test(parsed.key)) parsed.code = `Digit${parsed.key}`;
  return parsed;
}

export function matchesHotkey(event: KeyboardEvent, parsed: ParsedHotkey): boolean {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? "");
  const wantMeta = parsed.meta || (parsed.mod && isMac);
  const wantCtrl = parsed.ctrl || (parsed.mod && !isMac);
  if (event.altKey !== parsed.alt) return false;
  if (event.shiftKey !== parsed.shift) return false;
  if (event.metaKey !== wantMeta) return false;
  if (event.ctrlKey !== wantCtrl) return false;
  if (parsed.code) return event.code === parsed.code;
  return event.key.toLowerCase() === parsed.key;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Installs the non-UI activation triggers (keyboard, URL param, shake) and
 * returns a teardown. The floating pill is rendered by the overlay itself.
 */
export function installActivation(kit: GridKit, options: GridKitOptions): () => void {
  if (typeof window === "undefined") return () => {};
  const modes = activationList(options);
  const teardowns: Array<() => void> = [];

  if (modes.includes("keyboard")) {
    const parsed = parseHotkey(options.hotkey ?? DEFAULT_HOTKEY);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (!matchesHotkey(event, parsed)) return;
      // Plain single-key shortcuts must not fire while typing.
      if (!parsed.alt && !parsed.ctrl && !parsed.meta && !parsed.mod && isEditableTarget(event.target)) return;
      event.preventDefault();
      kit.toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    teardowns.push(() => window.removeEventListener("keydown", onKeyDown));
  }

  if (modes.includes("urlParam")) {
    try {
      const value = new URLSearchParams(window.location.search).get("gridkit");
      if (value !== null && value !== "0" && value !== "false" && value !== "off") kit.show();
    } catch {
      /* ignore */
    }
  }

  if (modes.includes("shake")) {
    teardowns.push(installShakeDetector(() => kit.toggle()));
  }

  return () => {
    for (const t of teardowns) t();
  };
}

/**
 * Best-effort shake detection via `devicemotion`. iOS Safari requires
 * `DeviceMotionEvent.requestPermission()` from a user gesture; we attach that
 * to the first pointer interaction so the grant prompt appears naturally.
 */
function installShakeDetector(onShake: () => void): () => void {
  if (typeof window === "undefined" || typeof DeviceMotionEvent === "undefined") return () => {};
  const THRESHOLD = 22; // m/s² of acceleration delta
  const COOLDOWN = 1000;
  let last: { x: number; y: number; z: number } | undefined;
  let lastShake = 0;

  const onMotion = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x == null || acc.y == null || acc.z == null) return;
    const current = { x: acc.x, y: acc.y, z: acc.z };
    if (last) {
      const delta = Math.abs(current.x - last.x) + Math.abs(current.y - last.y) + Math.abs(current.z - last.z);
      const now = Date.now();
      if (delta > THRESHOLD && now - lastShake > COOLDOWN) {
        lastShake = now;
        onShake();
      }
    }
    last = current;
  };

  const requestPermission = (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> })
    .requestPermission;
  let pointerListener: (() => void) | undefined;
  if (typeof requestPermission === "function") {
    pointerListener = () => {
      requestPermission
        .call(DeviceMotionEvent)
        .then((result) => {
          if (result === "granted") window.addEventListener("devicemotion", onMotion);
        })
        .catch(() => {});
      window.removeEventListener("pointerdown", pointerListener!);
      pointerListener = undefined;
    };
    window.addEventListener("pointerdown", pointerListener, { once: true });
  } else {
    window.addEventListener("devicemotion", onMotion);
  }

  return () => {
    window.removeEventListener("devicemotion", onMotion);
    if (pointerListener) window.removeEventListener("pointerdown", pointerListener);
  };
}

import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function GridIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg {...base} width={15} height={15}>
      {filled ? (
        <>
          <rect x="1.5" y="1.5" width="4" height="4" fill="currentColor" stroke="none" />
          <rect x="6" y="1.5" width="4" height="4" fill="currentColor" stroke="none" />
          <rect x="10.5" y="1.5" width="4" height="4" fill="currentColor" stroke="none" />
          <rect x="1.5" y="6" width="4" height="4" fill="currentColor" stroke="none" />
          <rect x="6" y="6" width="4" height="4" fill="currentColor" stroke="none" />
          <rect x="10.5" y="6" width="4" height="4" fill="currentColor" stroke="none" />
          <rect x="1.5" y="10.5" width="4" height="4" fill="currentColor" stroke="none" />
          <rect x="6" y="10.5" width="4" height="4" fill="currentColor" stroke="none" />
          <rect x="10.5" y="10.5" width="4" height="4" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
          <path d="M5.8 1.5v13M10.2 1.5v13M1.5 5.8h13M1.5 10.2h13" />
        </>
      )}
    </svg>
  );
}

export function SlidersIcon() {
  return (
    <svg {...base} width={11} height={11}>
      <path d="M2 4h12M2 8h12M2 12h12" />
      <circle cx="5" cy="4" r="1.6" fill="var(--gk-bg-solid)" />
      <circle cx="11" cy="8" r="1.6" fill="var(--gk-bg-solid)" />
      <circle cx="7" cy="12" r="1.6" fill="var(--gk-bg-solid)" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg {...base} width={16} height={16}>
      <circle cx="8" cy="8" r="6.5" fill="currentColor" stroke="none" opacity="0.5" />
      <path d="M5.2 7l2.8 2.8L10.8 7" stroke="var(--gk-bg-solid)" strokeWidth="1.6" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...base} width={16} height={16}>
      <circle cx="8" cy="8" r="6.5" fill="currentColor" stroke="none" opacity="0.5" />
      <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="var(--gk-bg-solid)" strokeWidth="1.6" />
    </svg>
  );
}

export function CameraIcon() {
  return (
    <svg {...base}>
      <path d="M2 5.5h2.6l1-1.7h4.8l1 1.7H14v7.5H2z" />
      <circle cx="8" cy="9" r="2.3" />
    </svg>
  );
}

export function ExportIcon() {
  return (
    <svg {...base}>
      <path d="M8 10V2M5 5l3-3 3 3M3 9v4.5h10V9" />
    </svg>
  );
}

export function ImportIcon() {
  return (
    <svg {...base}>
      <path d="M8 2v8M5 7l3 3 3-3M3 9v4.5h10V9" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg {...base}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
    </svg>
  );
}

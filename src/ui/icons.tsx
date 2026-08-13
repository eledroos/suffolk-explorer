/** Tiny inline icons, 16x16, drawn in currentColor. No icon library. */

interface IconProps {
  size?: number;
}

function svgProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    'aria-hidden': true as const,
  };
}

export function IconLine({ size = 15 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <polyline
        points="1.5,11.5 5.5,6.5 9,9.5 14.5,3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconBar({ size = 15 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <rect x="1.5" y="7" width="3" height="7" fill="currentColor" rx="0.5" />
      <rect x="6.5" y="3" width="3" height="11" fill="currentColor" rx="0.5" />
      <rect x="11.5" y="9" width="3" height="5" fill="currentColor" rx="0.5" />
    </svg>
  );
}

export function IconStack({ size = 15 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <rect x="2" y="8" width="4.4" height="6" fill="currentColor" rx="0.5" />
      <rect x="2" y="3.5" width="4.4" height="3.4" fill="currentColor" opacity="0.45" rx="0.5" />
      <rect x="9.5" y="10" width="4.4" height="4" fill="currentColor" rx="0.5" />
      <rect x="9.5" y="5.5" width="4.4" height="3.4" fill="currentColor" opacity="0.45" rx="0.5" />
    </svg>
  );
}

export function IconPct({ size = 15 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <rect x="2" y="2" width="4.4" height="12" fill="currentColor" opacity="0.35" rx="0.5" />
      <rect x="2" y="7" width="4.4" height="7" fill="currentColor" rx="0.5" />
      <rect x="9.5" y="2" width="4.4" height="12" fill="currentColor" opacity="0.35" rx="0.5" />
      <rect x="9.5" y="9.5" width="4.4" height="4.5" fill="currentColor" rx="0.5" />
    </svg>
  );
}

export function IconArea({ size = 15 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M1.5 14 V9 L6 5.5 L10 8 L14.5 3.5 V14 Z" fill="currentColor" opacity="0.5" />
      <path
        d="M1.5 9 L6 5.5 L10 8 L14.5 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconHeatmap({ size = 15 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}${c}`}
            x={1.5 + c * 4.6}
            y={1.5 + r * 4.6}
            width="3.8"
            height="3.8"
            rx="0.5"
            fill="currentColor"
            opacity={[0.9, 0.35, 0.6, 0.35, 0.7, 0.9, 0.5, 0.9, 0.25][r * 3 + c]}
          />
        )),
      )}
    </svg>
  );
}

export function IconPivot({ size = 15 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <line x1="1.5" y1="5.5" x2="14.5" y2="5.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconTable({ size = 15 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <rect x="1.5" y="2.5" width="13" height="2" fill="currentColor" rx="0.5" />
      <rect x="1.5" y="7" width="13" height="1.4" fill="currentColor" opacity="0.55" rx="0.5" />
      <rect x="1.5" y="10.5" width="13" height="1.4" fill="currentColor" opacity="0.55" rx="0.5" />
    </svg>
  );
}

export function IconSun({ size = 15 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.4" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <line
            key={a}
            x1={8 + Math.cos(rad) * 5.2}
            y1={8 + Math.sin(rad) * 5.2}
            x2={8 + Math.cos(rad) * 6.8}
            y2={8 + Math.sin(rad) * 6.8}
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

export function IconMoon({ size = 15 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path
        d="M13.2 9.8 A5.6 5.6 0 1 1 6.2 2.8 A4.6 4.6 0 0 0 13.2 9.8 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCopy({ size = 14 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10.5 3.5 V3 A1.5 1.5 0 0 0 9 1.5 H4 A1.5 1.5 0 0 0 2.5 3 V8 A1.5 1.5 0 0 0 4 9.5 h-.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconCheck({ size = 14 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <polyline
        points="2.5,8.5 6.5,12.5 13.5,4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDownload({ size = 14 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path
        d="M8 2 V10 M8 10 L4.8 6.8 M8 10 L11.2 6.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2.5 12.5 H13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconFilter({ size = 14 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path
        d="M1.8 3 H14.2 L9.6 8.4 V13 L6.4 11.4 V8.4 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconClose({ size = 13 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path
        d="M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconChevron({ size = 12, open = false }: IconProps & { open?: boolean }) {
  return (
    <svg
      {...svgProps(size)}
      style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}
    >
      <polyline
        points="5.5,3 10.5,8 5.5,13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTag({ size = 14 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path
        d="M2 2.5 H7.4 A1.5 1.5 0 0 1 8.5 3 L13.6 8.1 A1.5 1.5 0 0 1 13.6 10.2 L10.2 13.6 A1.5 1.5 0 0 1 8.1 13.6 L3 8.5 A1.5 1.5 0 0 1 2.5 7.4 V3 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="5.6" cy="5.6" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconExternal({ size = 11 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path
        d="M10.2 3 H3.8 A1 1 0 0 0 2.8 4 V12.2 A1 1 0 0 0 3.8 13.2 H12 A1 1 0 0 0 13 12.2 V6.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M6.3 9.7 L13 3 M6.7 3 H13 V9.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconInfo({ size = 14 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <line x1="8" y1="7.2" x2="8" y2="11.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="4.8" r="0.9" fill="currentColor" />
    </svg>
  );
}

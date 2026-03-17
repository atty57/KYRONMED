/**
 * KyraAvatar — animated AI avatar SVG
 * Orbit ring, breathing ring, cardinal tick marks, pulsing core.
 * Pure SVG SMIL animations — no JS runtime cost.
 */
export default function KyraAvatar({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">

      {/* Outer dashed orbit ring — slow rotation */}
      <circle
        cx="14" cy="14" r="12.5"
        stroke="rgba(147,197,253,0.25)"
        strokeWidth="0.75"
        strokeDasharray="3.5 3"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 14 14"
          to="360 14 14"
          dur="16s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Middle breathing ring */}
      <circle
        cx="14" cy="14" r="8.5"
        fill="none"
        stroke="rgba(59,130,246,0.40)"
        strokeWidth="0.9"
      >
        <animate attributeName="r"              values="8;9.2;8"        dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
        <animate attributeName="stroke-opacity" values="0.40;0.75;0.40" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
      </circle>

      {/* Core solid fill */}
      <circle cx="14" cy="14" r="5.8" fill="#3b82f6" />

      {/* Inner specular highlight (top-left) */}
      <ellipse cx="12.4" cy="12.2" rx="2.0" ry="1.4" fill="rgba(255,255,255,0.20)" />

      {/* Cardinal tick marks — staggered opacity pulse */}
      {/* Top tick */}
      <line x1="14" y1="7.2" x2="14" y2="9.4"
        stroke="rgba(255,255,255,0.88)" strokeWidth="1.2" strokeLinecap="round">
        <animate attributeName="stroke-opacity" values="0.88;0.22;0.88" dur="1.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
      </line>
      {/* Bottom tick — opposite phase */}
      <line x1="14" y1="18.6" x2="14" y2="20.8"
        stroke="rgba(255,255,255,0.50)" strokeWidth="1.2" strokeLinecap="round">
        <animate attributeName="stroke-opacity" values="0.22;0.88;0.22" dur="1.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
      </line>
      {/* Left tick */}
      <line x1="7.2" y1="14" x2="9.4" y2="14"
        stroke="rgba(255,255,255,0.70)" strokeWidth="1.2" strokeLinecap="round">
        <animate attributeName="stroke-opacity" values="0.70;0.18;0.70" dur="2.3s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
      </line>
      {/* Right tick — opposite phase */}
      <line x1="18.6" y1="14" x2="20.8" y2="14"
        stroke="rgba(255,255,255,0.38)" strokeWidth="1.2" strokeLinecap="round">
        <animate attributeName="stroke-opacity" values="0.18;0.70;0.18" dur="2.3s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
      </line>

      {/* Center pulsing dot */}
      <circle cx="14" cy="14" r="1.8" fill="white">
        <animate attributeName="r"            values="1.6;2.2;1.6" dur="1.25s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
        <animate attributeName="fill-opacity" values="0.80;1.0;0.80" dur="1.25s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
      </circle>

    </svg>
  );
}

/**
 * UserAvatar — clean user silhouette with a subtle idle ring
 */
export function UserAvatar({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background disc */}
      <circle cx="14" cy="14" r="13" fill="rgba(71,85,105,0.85)" stroke="rgba(148,163,184,0.18)" strokeWidth="0.75"/>
      {/* Subtle idle ring */}
      <circle cx="14" cy="14" r="11.5" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="0.6">
        <animate attributeName="stroke-opacity" values="0.12;0.28;0.12" dur="3.2s" repeatCount="indefinite"/>
      </circle>
      {/* Head */}
      <circle cx="14" cy="10.8" r="3.6" fill="rgba(255,255,255,0.82)" />
      {/* Shoulders / torso */}
      <path d="M6.5 24c0-4.142 3.358-7.5 7.5-7.5s7.5 3.358 7.5 7.5" fill="rgba(255,255,255,0.68)" />
    </svg>
  );
}

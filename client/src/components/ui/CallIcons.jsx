/**
 * CallIcons — animated SVG icons for all call-related UI.
 * All animations are pure SMIL — no JS runtime overhead.
 * All icons use a 20×20 internal viewbox and accept a `size` prop.
 */

/**
 * AIMicIcon — three voice bars inside a soft pulse ring.
 * Used for the "Call Kyra" dropdown option.
 */
export function AIMicIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Breathing pulse ring */}
      <circle cx="10" cy="10" r="8" fill="currentColor" opacity="0.10">
        <animate attributeName="r"       values="7;9;7"       dur="2s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
        <animate attributeName="opacity" values="0.10;0.18;0.10" dur="2s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
      </circle>

      {/* Voice wave bar — left */}
      <rect x="5.5" y="9" width="2.5" height="4" rx="1.25" fill="currentColor">
        <animate attributeName="height" values="4;9;4"   dur="0.85s" begin="0s"    repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
        <animate attributeName="y"      values="9;6;9"   dur="0.85s" begin="0s"    repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
      </rect>

      {/* Voice wave bar — center (tallest) */}
      <rect x="8.75" y="8" width="2.5" height="5" rx="1.25" fill="currentColor">
        <animate attributeName="height" values="5;12;5"  dur="0.85s" begin="0.17s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
        <animate attributeName="y"      values="8;4;8"   dur="0.85s" begin="0.17s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
      </rect>

      {/* Voice wave bar — right */}
      <rect x="12" y="9" width="2.5" height="4" rx="1.25" fill="currentColor">
        <animate attributeName="height" values="4;9;4"   dur="0.85s" begin="0.34s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
        <animate attributeName="y"      values="9;6;9"   dur="0.85s" begin="0.34s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
      </rect>
    </svg>
  );
}

/**
 * PhoneSmartIcon — smartphone that shakes + shows vibration arcs.
 * Used for "Call me" dropdown option and phone status badge.
 */
export function PhoneSmartIcon({ size = 13, ringing = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Phone body — shakes when ringing */}
      <g>
        {ringing && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; -0.6 0; 0.6 0; -0.4 0; 0.4 0; 0 0"
            dur="0.55s"
            repeatCount="indefinite"
          />
        )}
        <rect x="5.5" y="1.5" width="9" height="17" rx="2" stroke="currentColor" strokeWidth="1.3" fill="none"/>
        {/* Screen */}
        <rect x="7.5" y="4" width="5" height="8" rx="0.5" fill="currentColor" opacity="0.22"/>
        {/* Home bar */}
        <line x1="8.5" y1="15.5" x2="11.5" y2="15.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      </g>

      {/* Left vibration arc */}
      {ringing && (
        <path d="M3.5 7 C2.2 8.5 2.2 11.5 3.5 13" stroke="currentColor" strokeWidth="0.9" fill="none" strokeLinecap="round">
          <animate attributeName="stroke-opacity" values="0.8;0.1;0.8" dur="0.55s" repeatCount="indefinite"/>
        </path>
      )}
      {/* Right vibration arc */}
      {ringing && (
        <path d="M16.5 7 C17.8 8.5 17.8 11.5 16.5 13" stroke="currentColor" strokeWidth="0.9" fill="none" strokeLinecap="round">
          <animate attributeName="stroke-opacity" values="0.8;0.1;0.8" dur="0.55s" repeatCount="indefinite"/>
        </path>
      )}
    </svg>
  );
}

/**
 * MicIcon — microphone, optionally pulsing when active.
 * Used for mute-toggle buttons.
 */
export function MicIcon({ size = 13, active = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Expanding ring — only when active (unmuted) */}
      {active && (
        <circle cx="10" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="0.7">
          <animate attributeName="r"              values="4;9;4"     dur="1.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.3 0 0.7 1;0.3 0 0.7 1" keyTimes="0;0.6;1"/>
          <animate attributeName="stroke-opacity" values="0.5;0;0.5" dur="1.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.3 0 0.7 1;0.3 0 0.7 1" keyTimes="0;0.6;1"/>
        </circle>
      )}
      {/* Mic capsule */}
      <rect x="7" y="2" width="6" height="10" rx="3" fill="currentColor"/>
      {/* Arc */}
      <path d="M4 10 a6 6 0 0 0 12 0" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      {/* Stand */}
      <line x1="10" y1="16" x2="10" y2="18.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="7"  y1="18.5" x2="13" y2="18.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

/**
 * MicOffIcon — mic with a diagonal slash. For muted state.
 */
export function MicOffIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Mic capsule (dimmed) */}
      <rect x="7" y="2" width="6" height="10" rx="3" fill="currentColor" opacity="0.45"/>
      {/* Arc (dimmed) */}
      <path d="M4 10 a6 6 0 0 0 12 0" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.45"/>
      {/* Stand (dimmed) */}
      <line x1="10" y1="16" x2="10" y2="18.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.45"/>
      <line x1="7"  y1="18.5" x2="13" y2="18.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.45"/>
      {/* Slash */}
      <line x1="3.5" y1="3.5" x2="16.5" y2="16.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

/**
 * HangUpIcon — phone receiver in hang-up orientation.
 * Two rounded cups connected by a gently curved bridge, rotated 135°.
 * Renders clearly at 13 px (CallButton) and 22 px (VoiceOverlay).
 */
export function HangUpIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/*
        Phone receiver drawn horizontally, then rotated 135° around centre.
        Earpiece (was left) → upper-right; mouthpiece (was right) → lower-left.
        This is the universal "end / reject call" orientation.
      */}
      <g transform="rotate(135 10 10)">
        {/* Earpiece cup */}
        <rect x="1"  y="7" width="5.5" height="6" rx="2.75" fill="currentColor"/>
        {/* Bridge — curves gently downward so the icon has organic receiver feel */}
        <path
          d="M6.5 9.2 Q10 11.8 13.5 9.2 L13.5 10.8 Q10 13.4 6.5 10.8 Z"
          fill="currentColor"
        />
        {/* Mouthpiece cup */}
        <rect x="13.5" y="7" width="5.5" height="6" rx="2.75" fill="currentColor"/>
      </g>
    </svg>
  );
}

/**
 * ConnectSpinner — two dashed arcs rotating in opposite directions.
 * Replaces Loader2 for the "Connecting…" call state.
 */
export function ConnectSpinner({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer arc — clockwise */}
      <circle
        cx="10" cy="10" r="8"
        stroke="currentColor" strokeWidth="1.6"
        strokeDasharray="16 40"
        strokeLinecap="round"
      >
        <animateTransform attributeName="transform" type="rotate"
          from="0 10 10" to="360 10 10" dur="1.1s" repeatCount="indefinite"/>
      </circle>
      {/* Inner arc — counter-clockwise */}
      <circle
        cx="10" cy="10" r="5"
        stroke="currentColor" strokeWidth="1.2"
        strokeDasharray="9 24"
        strokeLinecap="round"
        opacity="0.55"
      >
        <animateTransform attributeName="transform" type="rotate"
          from="0 10 10" to="-360 10 10" dur="0.8s" repeatCount="indefinite"/>
      </circle>
    </svg>
  );
}

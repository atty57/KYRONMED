/**
 * StatusPulse — animated SVG online status indicator
 * Two sonar-ping rings expand and fade out from a solid green core.
 * Drop-in replacement for the CSS status dot, same visual footprint.
 */
export default function StatusPulse({ size = 10 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Online"
    >
      {/* Sonar ring 1 */}
      <circle cx="5" cy="5" r="2" fill="none" stroke="#34d399" strokeWidth="0.8">
        <animate attributeName="r"              values="2;5;2"         dur="2.4s" begin="0s"   repeatCount="indefinite" calcMode="spline" keySplines="0.2 0.4 0.4 1;0.2 0.4 0.4 1" keyTimes="0;0.7;1"/>
        <animate attributeName="stroke-opacity" values="0.75;0;0.75"   dur="2.4s" begin="0s"   repeatCount="indefinite" calcMode="spline" keySplines="0.2 0.4 0.4 1;0.2 0.4 0.4 1" keyTimes="0;0.7;1"/>
      </circle>

      {/* Sonar ring 2 — offset by half cycle */}
      <circle cx="5" cy="5" r="2" fill="none" stroke="#34d399" strokeWidth="0.6">
        <animate attributeName="r"              values="2;4.5;2"       dur="2.4s" begin="1.2s" repeatCount="indefinite" calcMode="spline" keySplines="0.2 0.4 0.4 1;0.2 0.4 0.4 1" keyTimes="0;0.7;1"/>
        <animate attributeName="stroke-opacity" values="0.55;0;0.55"   dur="2.4s" begin="1.2s" repeatCount="indefinite" calcMode="spline" keySplines="0.2 0.4 0.4 1;0.2 0.4 0.4 1" keyTimes="0;0.7;1"/>
      </circle>

      {/* Solid core dot — gentle breathe */}
      <circle cx="5" cy="5" r="2.6" fill="#34d399">
        <animate attributeName="r"    values="2.4;2.8;2.4" dur="1.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
        <animate attributeName="fill-opacity" values="0.90;1;0.90"    dur="1.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" keyTimes="0;0.5;1"/>
      </circle>

      {/* Tiny specular highlight */}
      <circle cx="4.2" cy="4.1" r="0.65" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}

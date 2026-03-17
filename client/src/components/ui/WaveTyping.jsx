/**
 * WaveTyping — animated SVG waveform typing indicator
 * Three bars rise and fall in a staggered sine wave.
 * Replaces the CSS dot typing indicator.
 */
export default function WaveTyping() {
  /* Each bar is centered on y=9 within an 18px-tall viewport.
     height 4 → y=7, height 14 → y=2  (y = 9 - height/2) */
  const bars = [
    { x: 4,  delay: '0s',    color: '#60A5FA' },
    { x: 15, delay: '0.18s', color: '#93C5FD' },
    { x: 26, delay: '0.36s', color: '#60A5FA' },
  ];

  return (
    <svg
      width="36"
      height="18"
      viewBox="0 0 36 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Typing…"
    >
      {bars.map(({ x, delay, color }) => (
        <rect key={x} x={x} width="6" rx="3" ry="3" fill={color} y="7" height="4">
          <animate
            attributeName="height"
            values="4;14;4"
            dur="0.85s"
            begin={delay}
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
            keyTimes="0;0.5;1"
          />
          <animate
            attributeName="y"
            values="7;2;7"
            dur="0.85s"
            begin={delay}
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
            keyTimes="0;0.5;1"
          />
          <animate
            attributeName="fill-opacity"
            values="0.7;1;0.7"
            dur="0.85s"
            begin={delay}
            repeatCount="indefinite"
          />
        </rect>
      ))}
    </svg>
  );
}

// Animated SVG app mark — "ghost channel" node.
//
// Concept: reuses the same circular-progress "signal ring" language as
// MessageCountdown (our other signature element) so the mark reads as part
// of the same visual system, not a bolted-on icon. A hex "node" rotates
// slowly (ambient, like the matrix rain — background presence, not
// distracting), a center dot pulses like a heartbeat/ping, and every few
// seconds a one-frame chromatic-glitch offset flashes across the strokes —
// same "glitch, not gimmick" restraint as the PIN-error interaction.
//
// Pure CSS animation (styled-jsx, built into Next.js) — no JS state, so this
// stays a server component and can be dropped anywhere (nav, lock screen,
// favicon-ish contexts). `prefers-reduced-motion` freezes everything to a
// single static frame via a plain media query, no JS needed.
//
// size prop controls the rendered box (viewBox is fixed at 48x48).
export default function Logo({
  size = 32,
  title = "ALEX-CHAT",
}: {
  size?: number;
  title?: string;
}) {
  return (
    <span
      className="alex-logo inline-flex shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={title}
    >
      <svg viewBox="0 0 48 48" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
        {/* magenta ghost layer — sits behind, offset slightly, creates the
            chromatic-aberration flicker when .glitch fires */}
        <g className="layer layer-ghost" stroke="#ff2d78">
          <polygon
            points="24,4 41,14 41,34 24,44 7,34 7,14"
            fill="none"
            strokeWidth="2"
          />
        </g>

        {/* primary cyan layer — the mark itself */}
        <g className="layer layer-main" stroke="#00e5ff">
          <polygon
            points="24,4 41,14 41,34 24,44 7,34 7,14"
            fill="none"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* scan ticks — echoes the countdown ring's radial marks */}
          <g className="ticks" strokeWidth="1.5" strokeLinecap="round">
            <line x1="24" y1="8" x2="24" y2="12" />
            <line x1="37" y1="16" x2="33.5" y2="18" />
            <line x1="37" y1="32" x2="33.5" y2="30" />
            <line x1="24" y1="40" x2="24" y2="36" />
            <line x1="11" y1="32" x2="14.5" y2="30" />
            <line x1="11" y1="16" x2="14.5" y2="18" />
          </g>
        </g>

        {/* pulsing core — the "ghost" that's still online */}
        <circle className="core" cx="24" cy="24" r="4" fill="#00e5ff" />
      </svg>

      <style>{`
        .alex-logo .layer-main {
          transform-origin: 24px 24px;
          animation: alex-spin 22s linear infinite;
        }
        .alex-logo .layer-ghost {
          transform-origin: 24px 24px;
          opacity: 0.55;
          animation: alex-spin 22s linear infinite, alex-glitch 6s ease-in-out infinite;
        }
        .alex-logo .ticks {
          transform-origin: 24px 24px;
          animation: alex-spin-rev 14s linear infinite;
        }
        .alex-logo .core {
          animation: alex-pulse 2.4s ease-in-out infinite;
        }

        @keyframes alex-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes alex-spin-rev {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes alex-pulse {
          0%, 100% { opacity: 1; r: 3.2; }
          50% { opacity: 0.5; r: 4.4; }
        }
        @keyframes alex-glitch {
          0%, 92%, 100% { transform: translate(0, 0); opacity: 0.55; }
          93% { transform: translate(-1.5px, 0.5px); opacity: 0.9; }
          95% { transform: translate(1.5px, -0.5px); opacity: 0.9; }
          97% { transform: translate(-1px, 0); opacity: 0.7; }
        }

        @media (prefers-reduced-motion: reduce) {
          .alex-logo .layer-main,
          .alex-logo .layer-ghost,
          .alex-logo .ticks,
          .alex-logo .core {
            animation: none !important;
          }
          .alex-logo .layer-ghost { opacity: 0.35; }
        }
      `}</style>
    </span>
  );
}

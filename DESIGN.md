# Design Plan — "Ghost Channel" theme

Direction: not the generic "matrix green-on-black" default — a two-tone cyberpunk
terminal look (cyan + magenta) that reads as a private ops/comms tool, not a
movie-hacker cliché. Everything is framed like a terminal session: chats are
"channels", messages are "transmissions", posts are the "board".

## Color tokens

| Token | Hex | Use |
|---|---|---|
| `--bg` | #05070a | page background |
| `--panel` | #0d1117 | cards, chat bubbles, nav |
| `--panel-raised` | #121a21 | modals, inputs |
| `--accent-cyan` | #00e5ff | primary actions, links, own messages |
| `--accent-magenta` | #ff2d78 | alerts, countdown urgency, other user's messages |
| `--text` | #d8f3ff | primary text |
| `--text-muted` | #5c7078 | timestamps, secondary text |
| `--danger` | #ff3860 | countdown < 60s, delete actions |
| `--border` | #1d2b33 | hairline borders |

## Typography

- Display / headings: `JetBrains Mono` (700) — wide letter-spacing on uppercase labels
- Body: `IBM Plex Mono` (400/500) — everything is monospace, reinforces "terminal" feel
- Both loaded via `next/font/google`

## Layout concept

- Sidebar (channel list) + main panel, like a terminal multiplexer (tmux-style thin dividers)
- Chat bubbles are terminal-prompt styled: `[you@alex ~]$` prefix on your own messages
- On mobile: sidebar collapses to a bottom nav, single-column stack

## Signature element

**Matrix-rain canvas background**, but restrained: very low opacity (~6%), only
cyan/magenta characters (not green), sits behind panels with a subtle blur —
ambient atmosphere, not distracting. Rendered once as a fixed canvas
(`components/MatrixRain.tsx`), respects `prefers-reduced-motion` (freezes to a
static frame if set).

Countdown timers double as a second signature motif: a thin circular progress
ring around a monospace mm:ss readout, color shifts cyan → magenta → danger red
as time runs out (not just a number).

## PIN lock screen

Full-screen terminal boot sequence: a few lines of fake boot text type out
(`INITIALIZING SECURE CHANNEL...`, `AUTH REQUIRED`), then a single PIN input
with a blinking block cursor. Wrong PIN triggers a brief glitch/shake, not a
red toast — stays in-world.

## Restraint

Motion budget: matrix rain (ambient, low-key) + countdown ring + one glitch
micro-interaction on PIN error. No extra scroll animations, no confetti, no
gratuitous transitions elsewhere — keeps the "ops tool" feel credible instead
of gimmicky.

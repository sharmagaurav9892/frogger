# Frogger

A Frogger-inspired hopper with a clean emerald UI, smooth canvas rendering, and a Top‑3 leaderboard. Pure HTML / CSS / JS — no server, no build step, no dependencies.

## Quick start

Just open `index.html` in a browser.

If you prefer serving it locally (some browsers restrict `file://` for things like fonts), any one‑liner static server works, e.g.:

```bash
python3 -m http.server 3000
# then open http://localhost:3000
```

## How to play

Get the frog from the bottom grass row safely to one of the five lily pads at the top.

- **Road (5 lanes)** — alternating traffic. Touch a vehicle, lose a life.
- **Median** — a safe strip of grass between the road and the river.
- **River (5 lanes)** — logs and turtle groups drift past. Ride them to cross. Slip off, or hit open water, and you drown. Turtles occasionally dive — time it.
- **Goal bank** — land squarely on an empty lily pad to score `+50`. Filling all five completes the level: `+100` bonus and the next level runs faster.

Lives: `3`. Game ends at `0`. Your score is then submitted to the local leaderboard.

## How scores are stored

Everything is stored in this browser's `localStorage`:

| Key | What |
| --- | ---- |
| `frogger.leaderboard` | The Top 3 leaderboard. |
| `frogger.player` | Your current player name on this device. |

Clearing site data (or the **Clear** button in the leaderboard) wipes scores. Scores are per‑browser/per‑device — they don't sync across machines.

## Controls

| Key                              | Action            |
| -------------------------------- | ----------------- |
| `←` `↑` `↓` `→` (or `W A S D`)   | Hop one cell      |
| `Space`                          | Play / Pause      |
| `R`                              | Restart           |
| **Change** (top right)           | Switch player     |
| **Clear** (leaderboard header)   | Wipe Top 3        |

On touch devices, an on-screen D-pad and pause button appear automatically.

## Files

```
frogger/
├── index.html       # Markup
├── styles.css       # Theme (mirrors snake-game)
├── game.js          # Game loop, rendering, input, leaderboard
└── README.md
```

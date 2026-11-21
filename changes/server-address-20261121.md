# The card server's address follows the PC's new name · 2026-11-21

The PC was renamed on 2026-11-20 at 23:49 (America/Denver) and restarted. Tailscale names a machine after its Windows
name, so the Funnel address the site was built with (`nv-1408202680.tail41447f.ts.net`) stopped answering, and every
friend's Draw Card fell back to a starter card.

- Funnel now serves the card server under the new name: `tailscale funnel --bg 8830` gives
  `https://makima.tail41447f.ts.net`, which answered `/api/health` from outside the tailnet (15 cards, writer claude).
- `.github/workflows/pages.yml` builds the site with that address (`VITE_PAPERMON_SERVER`).
- If the PC is renamed again: run `tailscale funnel --bg 8830`, read the new address from `tailscale funnel status`,
  and change this one line.

Claude Opus 5.5 (`claude-opus-5-5`), 2026-11-21.

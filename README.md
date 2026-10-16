# mcsr-overlay

OBS overlay for [MCSR Ranked](https://mcsrranked.com): rank badge, elo, PB, session stats and recent matches for any player.

**Live:** [orqz.github.io/mcsr-overlay](https://orqz.github.io/mcsr-overlay/) — open it, set it up, copy the URL into OBS. Nothing to download.

- `index.html` — customizer with live preview; builds the overlay URL for you
- `overlay.html` — the overlay itself; every option is a URL param, e.g. `overlay.html?u=orq2&style=tooltip&layout=bar`

## Styles and layouts

Pick any style with any layout.

| Style | Look |
| --- | --- |
| `badge` (default) | The rank badge up front, no box, text shadow so it reads over gameplay |
| `tooltip` | A Minecraft item tooltip, in the Monocraft font |
| `banner` | Broadcast graphics with tier-colored rules |
| `clean` | A minimal flat panel |

Layouts: `card` (everything), `bar` (one line), `compact` (elo and session), `matches` (recent results).

## Options

All of these are in the customizer; each is also a URL param.

- **Show:** player head, flag, tier, leaderboard #, peak, tier progress, best/average time, W–L, winrate, streak, FF rate, matches played, opponent elo/heads, seed icons, time ago
- **Session:** session elo, session time, session streak, new-match popup, idle reset (`reset`, hours)
- **Progress:** rank goal (`goal=Diamond I`, or an elo number), rotating info line in compact (`rotate`, seconds)
- **Look:** display name (`label`), size and scale, width, align/anchor, font, color palettes, background/text/muted/accent/border/win/loss colors, opacity, fill (solid/gradient), texture (grid/dots/noise), corners, border, shadows

## OBS setup

1. Open the [live customizer](https://orqz.github.io/mcsr-overlay/) (or `index.html` locally), enter a username, pick a layout and style, click **Copy URL**.
2. In OBS: **Sources → + → Browser**, untick **Local file**, paste the URL.
3. Set the width/height to the size shown in the customizer.

Data comes from the public MCSR Ranked API and refreshes every 30s by default.

## Credits

Rank badges, seed/bastion icons, division thresholds and tier colors are MCSR Ranked's own. Tooltip style uses [Monocraft](https://github.com/IdreesInc/Monocraft) (OFL-1.1). Player heads from mc-heads.net. Built with [Claude Code](https://claude.com/claude-code). Not affiliated with MCSR Ranked or Mojang.

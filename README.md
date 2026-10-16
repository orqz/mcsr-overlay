# mcsr-overlay

OBS overlay for [MCSR Ranked](https://mcsrranked.com): elo, rank tier, PB, session stats and recent matches for any player.

- `index.html` — customizer with live preview; builds the overlay URL for you
- `overlay.html` — the overlay itself; every option is a URL param, e.g. `overlay.html?u=orq2&layout=bar`

## OBS setup

1. Open `index.html`, enter a username, tweak the look, click **Copy URL**.
2. In OBS: **Sources → + → Browser**, untick **Local file**, paste the URL.
3. Set the width/height to the size shown in the customizer.

Data comes from the public MCSR Ranked API and refreshes every 30s by default.

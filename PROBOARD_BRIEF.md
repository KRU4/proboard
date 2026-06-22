# ProBoard — Live Employee Scoreboard
### Project Brief for Cursor

---

## What Is This?

**ProBoard** is a full-screen, TV-displayed employee scoreboard for **Pro Group Medical & Engineering Services**. It is designed to be opened on a smart TV in the office and left running — no interaction, no navigation, just a live competitive leaderboard that auto-refreshes.

The goal is to gamify performance data and drive sales/operations motivation through public visibility.

---

## Brand Identity

**Company:** Pro Group Medical & Engineering Services
**Website:** https://progroupeg.com
**Logo file:** `assets/pe-no-bg.png` (already in project — transparent background PNG)

**Brand Colors (extracted from logo and website):**
| Role | Hex |
|---|---|
| Primary Red | `#C8202A` |
| Primary Blue | `#1E4FA0` |
| Accent Green | `#4CAF50` |
| Dark Background (TV) | `#0A0E1A` |
| Card Surface | `#111827` |
| Text Primary | `#FFFFFF` |
| Text Muted | `#9CA3AF` |

**Typography feel:** Bold, heavy weight, high contrast. Think sports broadcast graphics — not corporate dashboard.

---

## Data Source — Three Supported Modes

The app supports **three data input modes**, selectable via a simple config variable at the top of the JS file:

### Mode 1 — Google Sheet (CSV Publish)
- The Google Sheet is published via **File → Share → Publish to web → CSV format**
- The app fetches the public CSV URL using `fetch()` every 60 seconds
- No API key needed — purely public read
- CSV format expected:

```
Name,Score
Ahmed Saber,148
Sara Mahmoud,134
Mohamed Ali,112
```

### Mode 2 — Local Excel/CSV File
- A file named `board/data.csv` sits inside the project folder
- The app reads it on load and on every 60-second interval
- Useful when the TV machine has no reliable internet or the sheet is private
- Same CSV format as above

### Mode 3 — Admin Panel (Manual Entry)
- A separate route/page: `/admin` or `admin.html`
- Simple password-protected form to enter employee names and scores manually
- Data saved to `localStorage` and read by the main board
- Used when neither Google Sheets nor a local file is available

**Config block at top of `main.js`:**
```js
const CONFIG = {
  mode: 'google_sheet', // 'google_sheet' | 'local_csv' | 'admin_panel'
  googleSheetCsvUrl: 'PASTE_YOUR_CSV_URL_HERE',
  localCsvPath: './board/data.csv',
  refreshIntervalSeconds: 60,
};
```

---

## UI/UX Requirements

### Screen Target
- **Resolution:** 1920×1080 (Full HD TV), landscape
- **Viewing distance:** 3–5 meters
- **Interaction:** Zero. Pure display mode.
- **Browser:** Chromium/Chrome in kiosk mode (`--kiosk` flag)

### Layout — Strict Grid

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo]          🏆 ProBoard — Weekly Scoreboard        [Date]  │  ← Header ~8vh
├──────────────────────────────┬──────────────────────────────────┤
│                              │  ┌────────────────────────────┐  │
│                              │  │  🥈  2nd Place Card        │  │
│       🥇 CHAMPION CARD       │  └────────────────────────────┘  │
│       (~55% width)           │                                   │
│                              │  ┌────────────────────────────┐  │
│       Big avatar             │  │  🥉  3rd Place Card        │  │
│       Huge name text         │  └────────────────────────────┘  │
│       Massive score badge    │                                   │
│                              │  ┌────────────────────────────┐  │
│                              │  │  4th, 5th... (smaller)     │  │
│                              │  └────────────────────────────┘  │
├──────────────────────────────┴──────────────────────────────────┤
│  Last synced: 14:32:05  •  Auto-refresh every 60s               │  ← Footer ~4vh
└─────────────────────────────────────────────────────────────────┘
```

### Visual Hierarchy Rules
- **1st place** card: takes ~55% of screen width. Avatar ~180px, name ~4.5rem, score ~7rem. Gold gradient border, pulsing glow animation.
- **2nd place** card: ~40% smaller than 1st. Silver accent.
- **3rd place** card: same size as 2nd. Bronze accent.
- **4th and below:** smaller horizontal list cards stacked below 2nd/3rd, no avatars, just rank + name + score.
- Font sizes must remain legible from 4 meters — minimum body text `1.4rem`.

### Animations
- On every data refresh, cards that **moved up** in rank play a brief green flash + slide-up animation.
- Cards that **moved down** play a subtle red flash.
- 1st place card has a continuous gold shimmer/glow loop (CSS only, no JS).
- No aggressive animations — this runs all day, not a YouTube thumbnail.

### Zero Chrome Rule
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100vw; height: 100vh; overflow: hidden; }
```
No scrollbars. No browser UI visible (kiosk mode). No borders on viewport edges.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Markup | HTML5 | Single file, no build step |
| Styling | Tailwind CSS via CDN | Rapid TV-scale utility classes |
| Logic | Vanilla JS (ES6+) | Zero dependencies, runs anywhere |
| Data | `fetch()` + CSV parsing | No backend needed |
| Fonts | Google Fonts — `Inter` or `Poppins` | Bold weights, clean at large sizes |

No React. No Node. No build process. Open `index.html` → done.

---

## Avatar Handling

Employee avatars are **optional**. The app handles both cases:
- If an `Avatar` column exists in the CSV with a URL → display the image
- If no avatar → display a generated colored circle with the employee's initials (first + last name initial), colored deterministically from their name using a simple hash

CSV with avatars:
```
Name,Score,Avatar
Ahmed Saber,148,https://example.com/ahmed.jpg
Sara Mahmoud,134,
```

---

## Admin Panel (`/admin.html`)

- Simple page, separate from the board
- Basic password field (hardcoded, not security-critical — this is internal tooling)
- Form: Add employee (name + score), Edit score, Remove employee
- Data persists in `localStorage` under key `proboard_data`
- Board auto-reads from `localStorage` when `mode: 'admin_panel'`

---

## What This Is NOT

- Not a real-time WebSocket app
- Not a database-backed app
- Not mobile-responsive (TV only)
- Not multi-tenant
- No user login system (admin panel has a single hardcoded PIN)

---

## Deliverable Files

See `PROBOARD_STRUCTURE.md` for the full file tree.

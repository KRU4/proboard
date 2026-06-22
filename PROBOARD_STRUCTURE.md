# ProBoard — Project Structure
### File Tree & Responsibility Map

---

## Full File Tree

```
proboard/
│
├── index.html                  # Main scoreboard — TV display page
├── admin.html                  # Admin panel — manual data entry
│
├── assets/
│   └── pe-no-bg.png            # Pro Group logo (transparent PNG) ← ALREADY PROVIDED
│
├── board/
│   └── data.csv                # Local CSV fallback (Mode 2)
│                               # Format: Name,Score[,Avatar]
│
├── css/
│   └── board.css               # Custom CSS on top of Tailwind
│                               # Contains: animations, glow effects,
│                               # TV-specific overrides, rank badge styles
│
├── js/
│   ├── config.js               # Single config object (mode, URLs, interval)
│   ├── data.js                 # Data fetching & CSV parsing logic
│   ├── renderer.js             # DOM rendering — builds all card HTML
│   ├── animations.js           # Rank-change detection & CSS class triggers
│   └── admin.js                # Admin panel logic (localStorage CRUD)
│
├── PROBOARD_BRIEF.md           # ← This project's brief (see companion file)
└── PROBOARD_STRUCTURE.md       # ← This file
```

---

## File Responsibilities

### `index.html`
- Loads Tailwind CDN, Google Fonts, `board.css`
- Contains the layout skeleton: header, champion zone, side column, footer
- Imports all JS modules at bottom of body
- Calls `initBoard()` on `DOMContentLoaded`
- **No logic here** — pure structure

### `admin.html`
- Separate standalone page
- PIN prompt on load (hardcoded, e.g. `1234`)
- Form: employee name input + score input + submit
- Table showing current entries with edit/delete buttons
- Save button writes to `localStorage` key `proboard_data`
- Link back to `index.html`

### `assets/pe-no-bg.png`
- The Pro Group logo — already provided by the client
- Used in the header of `index.html`, ~40px height, no background needed

### `board/data.csv`
- Flat CSV file, manually updated or replaced
- Used only when `CONFIG.mode === 'local_csv'`
- Format:
```csv
Name,Score,Avatar
Ahmed Saber,148,
Sara Mahmoud,134,https://i.imgur.com/xyz.jpg
Mohamed Ali,112,
```
- Avatar column is optional — leave empty for auto-initials avatar

---

### `js/config.js`

```js
const CONFIG = {
  // Data source mode:
  // 'google_sheet' → fetch public CSV URL
  // 'local_csv'    → read from board/data.csv
  // 'admin_panel'  → read from localStorage
  mode: 'google_sheet',

  googleSheetCsvUrl: 'PASTE_YOUR_PUBLISHED_CSV_URL_HERE',
  // How to get this URL:
  // Google Sheet → File → Share → Publish to web
  // → Select sheet → CSV format → Copy link

  localCsvPath: './board/data.csv',

  refreshIntervalSeconds: 60,

  adminPin: '1234', // Change this to whatever internal PIN you want

  boardTitle: 'Weekly Sales Scoreboard',
};
```

---

### `js/data.js`

**Responsibilities:**
- `fetchData()` — async function, switches on `CONFIG.mode`
  - `google_sheet`: `fetch(CONFIG.googleSheetCsvUrl)` → `.text()` → parse
  - `local_csv`: `fetch(CONFIG.localCsvPath)` → `.text()` → parse
  - `admin_panel`: `JSON.parse(localStorage.getItem('proboard_data'))` → normalize
- `parseCsv(rawText)` — splits by newline + comma, handles headers, returns array of `{ name, score, avatar }`
- `sortByScore(employees)` — descending sort, returns ranked array
- Returns normalized array: `[{ rank, name, score, avatar }, ...]`

---

### `js/renderer.js`

**Responsibilities:**
- `renderBoard(employees)` — main render function called after every fetch
- `renderChampion(employee)` — builds the large 1st-place card HTML
  - Gold gradient border
  - Crown icon (Unicode 👑 or SVG)
  - Avatar (image or initials circle)
  - Name in massive font
  - Score in huge badge
- `renderSecondary(employee, rank)` — builds 2nd and 3rd place cards (smaller, silver/bronze)
- `renderMinorRow(employee)` — builds compact horizontal row for 4th place and below
- `getInitialsAvatar(name)` — generates colored circle with initials from name
  - Color is deterministic: `hash(name) % colorPalette.length`
- `updateFooter(timestamp)` — writes last sync time to footer

**DOM target IDs:**
```
#champion-zone       → 1st place card container
#secondary-zone      → 2nd & 3rd place column
#minor-list          → 4th+ rows
#footer-sync         → sync status text
```

---

### `js/animations.js`

**Responsibilities:**
- `detectRankChanges(previousData, currentData)` — compares old vs new rank arrays
- Returns `{ movedUp: [names], movedDown: [names], unchanged: [names] }`
- `applyRankAnimations(changes)` — adds CSS classes:
  - `.rank-up` → green flash + slide-up (auto-removed after 1.5s)
  - `.rank-down` → red flash (auto-removed after 1.5s)
- `startChampionGlow()` — adds `champion-glow` class to 1st place card (persistent loop via CSS)
- Previous data stored in module-scoped variable, updated after each render

---

### `js/admin.js`

**Responsibilities:**
- `checkPin()` — on admin page load, prompt for PIN, redirect to `index.html` if wrong
- `loadFromStorage()` — reads `proboard_data` from localStorage → renders editable table
- `saveEmployee(name, score, avatar)` — adds or updates entry
- `deleteEmployee(name)` — removes entry
- `exportToCsv()` — optional: lets admin download current data as CSV
- `saveToStorage(data)` — writes normalized array back to localStorage

**localStorage schema:**
```json
{
  "proboard_data": [
    { "name": "Ahmed Saber", "score": 148, "avatar": "" },
    { "name": "Sara Mahmoud", "score": 134, "avatar": "" }
  ]
}
```

---

### `css/board.css`

**Contains (Tailwind can't do these):**

```css
/* 1st place card glow — runs all day, must be lightweight */
@keyframes champion-glow {
  0%, 100% { box-shadow: 0 0 30px 5px rgba(251, 191, 36, 0.4); }
  50%       { box-shadow: 0 0 60px 15px rgba(251, 191, 36, 0.7); }
}
.champion-glow { animation: champion-glow 3s ease-in-out infinite; }

/* Rank-up flash */
@keyframes rank-up-flash {
  0%   { background-color: rgba(34, 197, 94, 0.3); }
  100% { background-color: transparent; }
}
.rank-up { animation: rank-up-flash 1.5s ease-out forwards; }

/* Rank-down flash */
@keyframes rank-down-flash {
  0%   { background-color: rgba(239, 68, 68, 0.3); }
  100% { background-color: transparent; }
}
.rank-down { animation: rank-down-flash 1.5s ease-out forwards; }

/* TV zero-chrome reset */
html, body {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  padding: 0;
  background-color: #0A0E1A;
}

/* Gold gradient border for champion */
.champion-border {
  border: 3px solid transparent;
  background: linear-gradient(#111827, #111827) padding-box,
              linear-gradient(135deg, #F59E0B, #FCD34D, #F59E0B) border-box;
}
```

---

## Data Flow Diagram

```
Google Sheet (published CSV)
        │
        ▼
   data.js → fetch() every 60s
        │
        ▼
   parseCsv() → sortByScore()
        │
        ▼
   animations.js → detectRankChanges()
        │
        ▼
   renderer.js → renderBoard()
        │
        ▼
      DOM → TV Screen


Admin Panel (admin.html)
        │
        ▼
   admin.js → localStorage
        │
        ▼
   data.js reads localStorage (if mode = 'admin_panel')
        │
        ▼
   Same render pipeline ↑
```

---

## How to Run

```bash
# Option A — Direct browser open (local CSV mode only)
open index.html

# Option B — Local server (required for Google Sheet mode due to CORS)
npx serve .
# or
python3 -m http.server 8080

# Option C — TV Kiosk mode (Chrome)
google-chrome --kiosk --app=http://localhost:8080/index.html
```

---

## Google Sheet Setup (Step by Step)

1. Create a Google Sheet with columns: `Name`, `Score`, `Avatar` (Avatar is optional)
2. Fill in your employee data
3. Go to **File → Share → Publish to web**
4. Select the correct sheet tab
5. Change format from "Web page" to **"Comma-separated values (.csv)"**
6. Click **Publish** → copy the URL
7. Paste the URL into `CONFIG.googleSheetCsvUrl` in `js/config.js`
8. Done — the board will auto-fetch it every 60 seconds

---

## Cursor Implementation Notes

- Start with `index.html` + `css/board.css` + `js/config.js` + `js/data.js` + `js/renderer.js`
- Get the board rendering with hardcoded mock data first, then wire the fetch
- `admin.html` + `js/admin.js` can be built last
- The logo `assets/pe-no-bg.png` must be referenced in the header of `index.html`
- Use `position: fixed; inset: 0` on the root container to guarantee full-screen on TV
- Test at 1920×1080 browser window before declaring done

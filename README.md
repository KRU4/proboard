# ProBoard 🏆

Live Employee Scoreboard for Pro Group Medical & Engineering Services.
Displays real-time ranked employee scores on a smart TV screen.
Built with HTML5, Tailwind CSS, and Vanilla JavaScript.
Data source: Google Sheets (CSV), local CSV file, or manual admin panel.

## Quick Start

- Configure data source in `js/config.js`
- Run with: `npx serve .`
- Open in Chrome kiosk mode: `google-chrome --kiosk --app=http://localhost:3000`

## Data Modes

- **google_sheet**: Fetches from a published Google Sheet CSV URL
- **local_csv**: Reads from `board/data.csv`
- **admin_panel**: Manual entry via `admin.html`, stored in localStorage

## Project Structure

```
proboard/
├── index.html          # Main TV scoreboard display
├── admin.html          # Admin panel for manual data entry
├── README.md
├── pe-no-bg.png        # Company logo
├── css/
│   └── board.css       # TV styles, animations, glow effects
├── js/
│   ├── config.js       # Configuration (mode, paths, refresh interval)
│   ├── data.js         # CSV parsing & data fetching
│   ├── renderer.js     # DOM rendering — all card HTML
│   ├── animations.js   # Rank change detection & CSS triggers
│   └── admin.js        # Admin panel CRUD logic
└── board/
    └── data.csv        # Local CSV data source
```

## Tech Stack

| Layer   | Choice               |
| ------- | -------------------- |
| Markup  | HTML5                |
| Styling | Tailwind CSS via CDN |
| Logic   | Vanilla JS (ES6+)    |
| Data    | fetch() + CSV parsing |
| Fonts   | Poppins & Inter      |

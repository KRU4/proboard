# ProBoard — Convert to Electron Desktop Application

## Context
ProBoard is a live employee scoreboard for Pro Group Medical & Engineering Services.
Currently it is a web app (HTML/JS frontend + Express API + PostgreSQL).
We are converting it to a standalone Electron desktop application.

## Goal
A single Electron app that opens TWO windows simultaneously:
- **Window 1 (Admin):** shown on the operator's monitor — full admin control
- **Window 2 (Board):** shown on the TV — fullscreen scoreboard display, no chrome

Both windows communicate instantly via Electron IPC — no HTTP, no WebSocket, no network needed.

## Database
Keep PostgreSQL as the data store. The Electron main process connects directly to PostgreSQL using the `pg` npm package. No Express server needed anymore.

Connection details:
- Host: `192.168.31.253`
- Port: `5432`
- User: `evolution_user`
- Password: `YourStrongPassword123`
- Database: `proboard`
- Table: `employees (id, name, score, department, avatar, created_at, updated_at)`

---

## Project Structure

```
proboard-desktop/
├── package.json
├── main.js                  ← Electron main process
├── preload.js               ← Preload script (exposes IPC to renderer)
├── renderer/
│   ├── board/
│   │   ├── index.html       ← TV display window (existing board UI)
│   │   ├── board.css        ← existing board styles
│   │   └── board.js         ← board renderer logic
│   └── admin/
│       ├── index.html       ← Admin window (existing admin UI)
│       ├── admin.css        ← admin styles
│       └── admin.js         ← admin logic
└── assets/
    └── pe-no-bg.png         ← Pro Group logo
```

---

## main.js responsibilities

```js
// 1. Connect to PostgreSQL on app start using pg Pool
// 2. Open Admin Window — normal window, resizable, shown on primary display
// 3. Open Board Window — fullscreen, no menu bar, no dev tools, always on top, shown on secondary display if available
// 4. Handle IPC calls from admin window:
//    - 'get-employees'    → query DB → return sorted array
//    - 'add-employee'     → INSERT → return new list → broadcast to board
//    - 'update-employee'  → UPDATE → return new list → broadcast to board
//    - 'delete-employee'  → DELETE → return new list → broadcast to board
// 5. After any DB change, send 'employees-updated' event to board window with fresh data
```

---

## preload.js

Expose a clean API to both renderer windows using `contextBridge`:

```js
window.proboard = {
  getEmployees: () => ipcRenderer.invoke('get-employees'),
  addEmployee: (data) => ipcRenderer.invoke('add-employee', data),
  updateEmployee: (id, data) => ipcRenderer.invoke('update-employee', id, data),
  deleteEmployee: (id) => ipcRenderer.invoke('delete-employee', id),
  onEmployeesUpdated: (callback) => ipcRenderer.on('employees-updated', (_, data) => callback(data))
}
```

---

## renderer/board/index.html

Reuse the existing board UI exactly:
- Dark theme (`#0A0E1A` background)
- Champion card left (~55% width), 2nd/3rd place right (~45%)
- Crown emoji, gold glow animation on champion
- Avatar circle (image or initials fallback)
- Score badge
- Footer with last sync time
- On load: call `window.proboard.getEmployees()` → render
- Listen to `window.proboard.onEmployeesUpdated()` → re-render instantly when admin makes changes
- No polling needed (IPC handles real-time updates)

Brand colors:
- Background: `#0A0E1A`
- Card surface: `#111827`
- Primary Red: `#C8202A`
- Primary Blue: `#1E4FA0`
- Accent Green: `#4CAF50`
- Gold: `#F59E0B`

---

## renderer/admin/index.html

Reuse the existing admin UI:
- Clean dark theme matching the board
- Add Employee form: name, score, department, avatar URL or drag-and-drop image upload (base64)
- Employee table: shows all employees with Edit score and Delete buttons
- Inline score editing (click score → input field → save)
- Logo in header
- "View Board" button that focuses the board window
- All actions call `window.proboard.*` IPC methods
- On load: call `window.proboard.getEmployees()` → render table
- No PIN system needed (physical access controls the machine)

---

## package.json

```json
{
  "name": "proboard",
  "version": "1.0.0",
  "description": "Live Employee Scoreboard — Pro Group",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build:win": "electron-builder --win",
    "build:linux": "electron-builder --linux"
  },
  "dependencies": {
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-builder": "^24.0.0"
  },
  "build": {
    "appId": "com.progroup.proboard",
    "productName": "ProBoard",
    "icon": "assets/pe-no-bg.png",
    "win": {
      "target": "nsis"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

---

## Key behaviors

### Two-monitor support
In `main.js`, detect available displays using `screen.getAllDisplays()`:
- If 2 monitors found: open admin on primary, board on secondary (fullscreen)
- If 1 monitor found: open both windows, board is fullscreen on top, admin is accessible via taskbar

### Board window properties
```js
{
  fullscreen: true,
  autoHideMenuBar: true,
  webPreferences: { preload: path.join(__dirname, 'preload.js') }
}
```

### Admin window properties
```js
{
  width: 1200,
  height: 800,
  minWidth: 900,
  minHeight: 600,
  webPreferences: { preload: path.join(__dirname, 'preload.js') }
}
```

### Real-time update flow
```
Admin clicks "Save" 
  → IPC invoke 'update-employee' 
  → main.js runs UPDATE query 
  → fetches fresh sorted list 
  → sends 'employees-updated' to board window 
  → board re-renders immediately (no delay)
```

### Avatar handling
- If avatar is a base64 string or URL → display as `<img>` with `border-radius: 50%`
- If no avatar → show colored circle with initials (deterministic color from name hash)

---

## Implementation order

1. `package.json` + `npm install`
2. `main.js` — DB connection + two windows + all IPC handlers
3. `preload.js` — contextBridge API
4. `renderer/board/index.html` + `board.js` — board UI using IPC
5. `renderer/admin/index.html` + `admin.js` — admin UI using IPC
6. Test with `npm start`

---

## Important notes
- Use `contextIsolation: true` and `nodeIntegration: false` for security
- All DB queries happen in main process only — never in renderer
- Tailwind CSS: use the CDN script tag in both HTML files `<script src="https://cdn.tailwindcss.com"></script>` — the machine running the app will have internet access
- The existing `api/` folder and `docker-compose.yml` are no longer needed for this desktop version
- Do not use React or any framework — vanilla JS only

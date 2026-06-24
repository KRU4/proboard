# ProBoard Electron — Excel File Watcher Feature

## Feature Summary
Instead of manually entering employees in the admin panel, the user can select an existing Excel (.xlsx/.xls) accounts sheet. The app reads employee names and their total scores from it, saves them to PostgreSQL, and watches the file for changes — updating the scoreboard live whenever the file is saved.

---

## Excel File Structure (IMPORTANT — read carefully)

The accounts sheet has this layout:

- **Row 1:** Employee names start at **column V (index 22)** and go rightward
  - Example: `V1=Osama, W1=Dwidar, X1=mahmud, Y1=ashraf, Z1=gizawi, AA1=ali, AB1=abd alrahman, AC1=A.Ragab, AD1=Kenan, AE1=ashry`
  - New employees are added by adding more columns to the right — the column count is dynamic
  - Columns A through U (1–21) are other accounting data — **ignore them completely**

- **Rows 2 to 104:** Individual transaction values per employee (numbers or empty)

- **Row 105:** SUM formula row — `=SUM(V2:V104)` etc. — this is the **total score per employee**
  - This is the row we read as the score
  - Since openpyxl reads formula strings not calculated values in read_only mode, use `data_only=True` when loading the workbook to get the cached calculated values

- **Rows 106–110:** Additional formula rows — **ignore them**

### Reading logic summary:
```
Names  = Row 1,  columns V onwards (skip any None/empty columns)
Scores = Row 105, same columns as the names (matching by column index)
```

---

## User Story

1. User opens the Electron app for the first time
2. Admin window appears — empty employee table + **"Choose Excel File"** button prominently displayed
3. User clicks "Choose Excel File"
4. Native OS file picker opens (Electron `dialog.showOpenDialog`) filtered to `.xlsx` and `.xls` files
5. User selects the accounts Excel file
6. App reads the file using `xlsx` npm package (SheetJS) with `cellFormula: false` to get cached values
7. App extracts names (Row 1, col V+) and scores (Row 105, same columns)
8. App upserts all employees into PostgreSQL (`INSERT ... ON CONFLICT (name) DO UPDATE SET score = ...`)
9. Board window immediately shows the scoreboard with the imported employees
10. App starts watching the file using `chokidar` — on every `change` event (file save):
    - Re-read the Excel file
    - Re-extract names and scores
    - Upsert into PostgreSQL
    - Send `employees-updated` IPC event to board window
    - Board re-renders instantly

---

## Implementation

### New npm dependencies to add to package.json:
```json
"xlsx": "^0.18.5",
"chokidar": "^3.6.0"
```

### New IPC handlers to add in main.js:

#### `'choose-excel-file'`
```js
ipcMain.handle('choose-excel-file', async () => {
  const result = await dialog.showOpenDialog(adminWindow, {
    title: 'Select Accounts Excel File',
    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile']
  });
  if (result.canceled) return { success: false };
  
  const filePath = result.filePaths[0];
  await readAndSyncExcel(filePath);
  startWatchingFile(filePath);
  return { success: true, filePath };
});
```

#### `readAndSyncExcel(filePath)` — internal function
```js
async function readAndSyncExcel(filePath) {
  const XLSX = require('xlsx');
  const wb = XLSX.readFile(filePath, { cellFormula: false, cellNF: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Row 0 (index) = names row (Row 1 in Excel)
  // Row 104 (index) = scores row (Row 105 in Excel)
  const namesRow = data[0];    // array, columns 0-based
  const scoresRow = data[104]; // array, columns 0-based

  // Column V = index 21 (0-based)
  const START_COL = 21;

  const employees = [];
  for (let col = START_COL; col < namesRow.length; col++) {
    const name = namesRow[col];
    const score = scoresRow ? scoresRow[col] : 0;
    if (name && typeof name === 'string' && name.trim() !== '') {
      employees.push({
        name: name.trim(),
        score: typeof score === 'number' ? Math.round(score) : 0
      });
    }
  }

  // Upsert all employees into PostgreSQL
  for (const emp of employees) {
    await pool.query(
      `INSERT INTO employees (name, score, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (name) DO UPDATE SET score = $2, updated_at = NOW()`,
      [emp.name, emp.score]
    );
  }

  // Broadcast fresh data to board
  const result = await pool.query('SELECT * FROM employees ORDER BY score DESC');
  boardWindow.webContents.send('employees-updated', result.rows);
  
  return employees;
}
```

> ⚠️ The employees table needs a UNIQUE constraint on `name` for the upsert to work.
> Add this migration at app startup if it doesn't exist:
> ```sql
> ALTER TABLE employees ADD CONSTRAINT employees_name_unique UNIQUE (name);
> ```

#### `startWatchingFile(filePath)` — internal function
```js
let watcher = null;

function startWatchingFile(filePath) {
  if (watcher) watcher.close(); // stop previous watcher if any
  
  const chokidar = require('chokidar');
  watcher = chokidar.watch(filePath, {
    persistent: true,
    usePolling: true,      // required for network drives and some Excel save behaviors
    interval: 2000,        // check every 2 seconds
    awaitWriteFinish: {    // wait for Excel to finish writing before reading
      stabilityThreshold: 1000,
      pollInterval: 500
    }
  });
  
  watcher.on('change', async () => {
    console.log('Excel file changed, re-syncing...');
    try {
      await readAndSyncExcel(filePath);
    } catch (err) {
      console.error('Error re-reading Excel:', err);
    }
  });
}
```

#### `'get-watched-file'`
```js
ipcMain.handle('get-watched-file', () => {
  return currentWatchedFile || null; // store the path in a module-level variable
});
```

---

## Admin window UI changes (renderer/admin/index.html + admin.js)

### Add at the TOP of the admin panel (above the Add Employee form):

```html
<div id="excel-section" class="...">
  <div id="no-file-state">
    <p>No data source connected.</p>
    <button id="choose-file-btn">📂 Choose Excel File</button>
  </div>
  <div id="file-connected-state" style="display:none;">
    <span>📊 Live sync: <strong id="connected-file-name"></strong></span>
    <button id="change-file-btn">Change File</button>
  </div>
</div>
```

### Admin.js logic:
```js
// On load — check if a file was previously watched
const watchedFile = await window.proboard.getWatchedFile();
if (watchedFile) {
  showFileConnectedState(path.basename(watchedFile));
}

document.getElementById('choose-file-btn').addEventListener('click', async () => {
  const result = await window.proboard.chooseExcelFile();
  if (result.success) {
    showFileConnectedState(result.filePath.split('/').pop());
    await refreshEmployeeTable();
  }
});
```

---

## Preload additions

Add to `window.proboard` in preload.js:
```js
chooseExcelFile: () => ipcRenderer.invoke('choose-excel-file'),
getWatchedFile: () => ipcRenderer.invoke('get-watched-file'),
```

---

## Persist the watched file path across restarts

Store the last selected file path using Electron's `app.getPath('userData')`:

```js
const path = require('path');
const fs = require('fs');

const configPath = path.join(app.getPath('userData'), 'proboard-config.json');

function saveConfig(data) {
  fs.writeFileSync(configPath, JSON.stringify(data));
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

// On app start:
const config = loadConfig();
if (config.watchedFile && fs.existsSync(config.watchedFile)) {
  currentWatchedFile = config.watchedFile;
  readAndSyncExcel(config.watchedFile);
  startWatchingFile(config.watchedFile);
}

// After successful file selection:
saveConfig({ watchedFile: filePath });
```

---

## What does NOT change
- Board window UI (index.html) — no changes
- The manual Add/Edit/Delete employee functionality in admin panel — keep it, it works alongside the Excel sync
- PostgreSQL connection — unchanged
- IPC for get/add/update/delete employees — unchanged

---

## Implementation order
1. Add `xlsx` and `chokidar` to package.json → `npm install`
2. Add `readAndSyncExcel()` and `startWatchingFile()` functions to main.js
3. Add `choose-excel-file` and `get-watched-file` IPC handlers
4. Add config persistence (load on startup, save on file select)
5. Add the UNIQUE constraint migration on app startup
6. Update preload.js with new methods
7. Update admin HTML/JS with the Excel section UI
8. Test with `npm start`

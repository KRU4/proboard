const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const XLSX = require('xlsx');
const chokidar = require('chokidar');

let adminWindow = null;
let boardWindow = null;
let watcher = null;
let currentWatchedFile = null;

const pool = new Pool({
  host: process.env.DB_HOST || '192.168.31.253',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'evolution_user',
  password: process.env.DB_PASSWORD || 'YourStrongPassword123',
  database: process.env.DB_NAME || 'proboard',
});

const configPath = path.join(app.getPath('userData'), 'proboard-config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      department TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'employees_name_unique'
      ) THEN
        ALTER TABLE employees ADD CONSTRAINT employees_name_unique UNIQUE (name);
      END IF;
    END $$
  `);
}

async function fetchEmployeesSorted() {
  const { rows } = await pool.query(
    'SELECT id, name, score, department, avatar FROM employees ORDER BY score DESC'
  );
  return rows.map((row, idx) => ({ ...row, rank: idx + 1 }));
}

function broadcastEmployeesUpdated(employees) {
  if (boardWindow && !boardWindow.isDestroyed()) {
    boardWindow.webContents.send('employees-updated', employees);
  }
  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.webContents.send('employees-updated', employees);
  }
}

async function readAndSyncExcel(filePath) {
  const wb = XLSX.readFile(filePath, { cellFormula: false, cellNF: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const namesRow = data[0];
  const scoresRow = data[104];
  const START_COL = 21;

  const employees = [];
  if (namesRow) {
    for (let col = START_COL; col < namesRow.length; col++) {
      const name = namesRow[col];
      const score = scoresRow ? scoresRow[col] : 0;
      if (name && typeof name === 'string' && name.trim() !== '') {
        employees.push({
          name: name.trim(),
          score: typeof score === 'number' ? Math.round(score) : 0,
        });
      }
    }
  }

  for (const emp of employees) {
    await pool.query(
      `INSERT INTO employees (name, score, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (name) DO UPDATE SET score = $2, updated_at = NOW()`,
      [emp.name, emp.score]
    );
  }

  const result = await fetchEmployeesSorted();
  broadcastEmployeesUpdated(result);
  return employees;
}

function startWatchingFile(filePath) {
  if (watcher) watcher.close();

  watcher = chokidar.watch(filePath, {
    persistent: true,
    usePolling: true,
    interval: 2000,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 500,
    },
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

function createAdminWindow(display) {
  adminWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    x: display.bounds.x + 50,
    y: display.bounds.y + 50,
    title: 'ProBoard — Admin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  adminWindow.loadFile(path.join(__dirname, 'renderer', 'admin', 'index.html'));
  adminWindow.on('closed', () => { adminWindow = null; });
}

function createBoardWindow(display) {
  boardWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    fullscreen: true,
    autoHideMenuBar: true,
    title: 'ProBoard — Live Scoreboard',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  boardWindow.loadFile(path.join(__dirname, 'renderer', 'board', 'index.html'));
  boardWindow.on('closed', () => { boardWindow = null; });
}

function createWindows() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const secondary = displays.length > 1
    ? displays.find((d) => d.id !== primary.id) || primary
    : primary;

  createAdminWindow(primary);
  createBoardWindow(displays.length > 1 ? secondary : primary);

  if (displays.length === 1) {
    boardWindow.setAlwaysOnTop(true, 'screen-saver');
  }
}

function registerIpcHandlers() {
  ipcMain.handle('get-employees', async () => fetchEmployeesSorted());

  ipcMain.handle('add-employee', async (_event, data) => {
    const { name, score, department, avatar } = data;
    await pool.query(
      'INSERT INTO employees (name, score, department, avatar) VALUES ($1, $2, $3, $4)',
      [name, parseInt(score, 10) || 0, department || '', avatar || '']
    );
    const employees = await fetchEmployeesSorted();
    broadcastEmployeesUpdated(employees);
    return employees;
  });

  ipcMain.handle('update-employee', async (_event, id, data) => {
    const fields = [];
    const values = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.score !== undefined) { fields.push(`score = $${idx++}`); values.push(parseInt(data.score, 10) || 0); }
    if (data.department !== undefined) { fields.push(`department = $${idx++}`); values.push(data.department); }
    if (data.avatar !== undefined) { fields.push(`avatar = $${idx++}`); values.push(data.avatar); }

    if (fields.length) {
      fields.push('updated_at = NOW()');
      values.push(id);
      await pool.query(
        `UPDATE employees SET ${fields.join(', ')} WHERE id = $${idx}`,
        values
      );
    }

    const employees = await fetchEmployeesSorted();
    broadcastEmployeesUpdated(employees);
    return employees;
  });

  ipcMain.handle('delete-employee', async (_event, id) => {
    await pool.query('DELETE FROM employees WHERE id = $1', [id]);
    const employees = await fetchEmployeesSorted();
    broadcastEmployeesUpdated(employees);
    return employees;
  });

  ipcMain.handle('choose-excel-file', async () => {
    const result = await dialog.showOpenDialog(adminWindow, {
      title: 'Select Accounts Excel File',
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile'],
    });

    if (result.canceled) return { success: false };

    const filePath = result.filePaths[0];
    await readAndSyncExcel(filePath);
    startWatchingFile(filePath);
    currentWatchedFile = filePath;
    saveConfig({ watchedFile: filePath });

    return { success: true, filePath };
  });

  ipcMain.handle('get-watched-file', () => currentWatchedFile || null);

  ipcMain.handle('focus-board', () => {
    if (boardWindow && !boardWindow.isDestroyed()) {
      boardWindow.show();
      boardWindow.focus();
      return true;
    }
    return false;
  });
}

app.whenReady().then(async () => {
  try {
    await initDatabase();
  } catch (err) {
    console.error('Database init error:', err.message);
  }

  registerIpcHandlers();

  const config = loadConfig();
  if (config.watchedFile && fs.existsSync(config.watchedFile)) {
    currentWatchedFile = config.watchedFile;
  }

  createWindows();

  if (currentWatchedFile) {
    try {
      await readAndSyncExcel(currentWatchedFile);
      startWatchingFile(currentWatchedFile);
    } catch (err) {
      console.error('Failed to load watched Excel file:', err.message);
    }
  }
});

app.on('window-all-closed', () => {
  if (watcher) watcher.close();
  pool.end();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindows();
});

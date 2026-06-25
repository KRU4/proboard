const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const XLSX = require('xlsx');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
    }
  },
});

const pool = new Pool({
  host: process.env.DB_HOST || '192.168.31.253',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'evolution_user',
  password: process.env.DB_PASSWORD || 'YourStrongPassword123',
  database: process.env.DB_NAME || 'proboard',
});

pool.query(`
  CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    department TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`).then(() => pool.query(`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'employees_name_unique'
    ) THEN
      ALTER TABLE employees ADD CONSTRAINT employees_name_unique UNIQUE (name);
    END IF;
  END $$
`)).catch(err => console.error('DB init error:', err.message));

app.get('/api/employees', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, score, department, avatar FROM employees ORDER BY score DESC');
    res.json(rows);
  } catch (err) {
    console.error('GET /api/employees error:', err.message);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    const { name, score, department, avatar } = req.body;
    if (!name || score === undefined) {
      return res.status(400).json({ error: 'name and score are required' });
    }
    const { rows } = await pool.query(
      'INSERT INTO employees (name, score, department, avatar) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, parseInt(score, 10) || 0, department || '', avatar || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /api/employees error:', err.message);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, score, department, avatar } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (score !== undefined) { fields.push(`score = $${idx++}`); values.push(parseInt(score, 10) || 0); }
    if (department !== undefined) { fields.push(`department = $${idx++}`); values.push(department); }
    if (avatar !== undefined) { fields.push(`avatar = $${idx++}`); values.push(avatar); }

    if (!fields.length) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE employees SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /api/employees/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM employees WHERE id = $1', [id]);
    if (!rowCount) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/employees/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

// POST /api/sheets — return sheet names from uploaded Excel
app.post('/api/sheets', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', bookSheets: true });
    res.json({ sheets: workbook.SheetNames });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import — upload Excel or CSV and upsert employees
app.post('/api/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sheetIndex = parseInt(req.body.sheetIndex, 10) || 0;
    const clearFirst = req.body.clearFirst === 'true';

    const workbook = XLSX.read(req.file.buffer, {
      type: 'buffer',
      cellFormula: false,
      cellNF: false,
    });

    const sheetName = workbook.SheetNames[sheetIndex] || workbook.SheetNames[0];
    const ws = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    const namesRow = data[0];
    const scoresRow = data[104];
    const START_COL = 21;

    if (!namesRow) {
      return res.status(400).json({ error: 'File is empty or unreadable' });
    }

    const employees = [];
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

    if (!employees.length) {
      return res.status(400).json({
        error: 'No employee data found. Make sure the file is the correct accounts sheet.',
      });
    }

    if (clearFirst) {
      await pool.query('DELETE FROM employees');
    }

    let inserted = 0;
    let updated = 0;

    for (const emp of employees) {
      const result = await pool.query(
        `INSERT INTO employees (name, score, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (name) DO UPDATE SET score = $2, updated_at = NOW()
         RETURNING (xmax = 0) AS is_insert`,
        [emp.name, emp.score]
      );
      if (result.rows[0].is_insert) inserted++;
      else updated++;
    }

    res.json({
      success: true,
      message: `Import done: ${inserted} added, ${updated} updated`,
      inserted,
      updated,
      total: inserted + updated,
    });
  } catch (err) {
    console.error('POST /api/import error:', err.message);
    res.status(500).json({ error: err.message || 'Import failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ProBoard API running on port ${PORT}`);
});

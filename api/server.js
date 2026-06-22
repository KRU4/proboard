const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
`).catch(err => console.error('DB init error:', err.message));

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ProBoard API running on port ${PORT}`);
});

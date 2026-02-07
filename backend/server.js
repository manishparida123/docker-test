const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: 5432,
  user: process.env.DB_USER || 'taskuser',
  password: process.env.DB_PASSWORD || 'taskpass',
  database: process.env.DB_NAME || 'taskdb'
});

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis'}:6379`
});

redisClient.connect().catch(console.error);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const cacheKey = 'tasks:all';
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return res.json({ source: 'cache', data: JSON.parse(cached) });
    }

    const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    await redisClient.setEx(cacheKey, 60, JSON.stringify(result.rows));
    res.json({ source: 'database', data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create task
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description } = req.body;
    const result = await pool.query(
      'INSERT INTO tasks (title, description) VALUES ($1, $2) RETURNING *',
      [title, description]
    );
    await redisClient.del('tasks:all');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
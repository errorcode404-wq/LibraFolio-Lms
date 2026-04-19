const express = require('express');
const cors = require('cors');
const path = require('path');

// ── Initialize DB (creates + seeds on first run) ──────────
require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ────────────────────────────────────────────
app.use('/api/books',        require('./routes/books'));
app.use('/api/members',      require('./routes/members'));
app.use('/api/transactions', require('./routes/transactions'));

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Catch-all: serve frontend ─────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global error handler ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`\n📚 LibraFolio is running at http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api\n`);
});

const express = require('express');
const router = express.Router();
const db = require('../database');

// Generate next member ID
function nextMemberId() {
  const last = db.prepare("SELECT id FROM members ORDER BY id DESC LIMIT 1").get();
  if (!last) return 'M001';
  const num = parseInt(last.id.replace('M', '')) + 1;
  return 'M' + String(num).padStart(3, '0');
}

// GET /api/members
router.get('/', (req, res) => {
  try {
    const { q } = req.query;
    let sql = `
      SELECT m.*,
        (SELECT COUNT(*) FROM transactions t WHERE t.member_id = m.id AND t.return_date IS NULL) AS active_loans,
        (SELECT COALESCE(SUM(
          CASE WHEN t.return_date IS NULL AND date(t.due_date) < date('now')
               THEN CAST((julianday('now') - julianday(t.due_date)) AS INTEGER) * 0.50
               ELSE 0 END
        ), 0) FROM transactions t WHERE t.member_id = m.id) AS total_fines
      FROM members m
    `;
    const params = [];
    if (q) {
      sql += ' WHERE (m.name LIKE ? OR m.email LIKE ? OR m.id LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    sql += ' ORDER BY m.name ASC';
    const members = db.prepare(sql).all(...params);
    res.json({ success: true, data: members, total: members.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/members/:id — with loan details
router.get('/:id', (req, res) => {
  try {
    const member = db.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM transactions t WHERE t.member_id = m.id AND t.return_date IS NULL) AS active_loans,
        (SELECT COALESCE(SUM(
          CASE WHEN t.return_date IS NULL AND date(t.due_date) < date('now')
               THEN CAST((julianday('now') - julianday(t.due_date)) AS INTEGER) * 0.50
               ELSE 0 END
        ), 0) FROM transactions t WHERE t.member_id = m.id) AS total_fines
      FROM members m WHERE m.id = ?
    `).get(req.params.id);

    if (!member) return res.status(404).json({ success: false, error: 'Member not found' });

    const loans = db.prepare(`
      SELECT t.*, b.title, b.author, b.isbn
      FROM transactions t
      JOIN books b ON b.id = t.book_id
      WHERE t.member_id = ? AND t.return_date IS NULL
    `).all(req.params.id);

    res.json({ success: true, data: { ...member, loans } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/members
router.post('/', (req, res) => {
  try {
    const { name, email, phone, type } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'Name and email are required.' });
    }
    const existing = db.prepare('SELECT id FROM members WHERE email = ?').get(email.trim());
    if (existing) {
      return res.status(409).json({ success: false, error: 'A member with this email already exists.' });
    }
    const id = nextMemberId();
    const today = new Date().toISOString().split('T')[0];
    db.prepare('INSERT INTO members (id, name, email, phone, type, joined) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, name.trim(), email.trim(), phone || null, type || 'Student', today);
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: member });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/members/:id
router.delete('/:id', (req, res) => {
  try {
    const activeLoans = db.prepare(
      'SELECT COUNT(*) AS c FROM transactions WHERE member_id = ? AND return_date IS NULL'
    ).get(req.params.id).c;
    if (activeLoans > 0) {
      return res.status(400).json({ success: false, error: 'Cannot remove: member has active loans.' });
    }
    const result = db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Member not found' });
    res.json({ success: true, message: 'Member removed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

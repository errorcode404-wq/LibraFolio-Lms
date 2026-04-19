const express = require('express');
const router = express.Router();
const db = require('../database');

const FINE_PER_DAY = 0.50;

function nextTxnId() {
  const last = db.prepare("SELECT id FROM transactions ORDER BY id DESC LIMIT 1").get();
  if (!last) return 'T001';
  const num = parseInt(last.id.replace('T', '')) + 1;
  return 'T' + String(num).padStart(3, '0');
}

function calcFine(dueDate, returnDate) {
  const due = new Date(dueDate);
  const ref = returnDate ? new Date(returnDate) : new Date();
  const diffDays = Math.floor((ref - due) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? +(diffDays * FINE_PER_DAY).toFixed(2) : 0;
}

function resolveStatus(txn) {
  if (txn.return_date) return 'Returned';
  return new Date(txn.due_date) < new Date() ? 'Overdue' : 'Borrowed';
}

// GET /api/transactions — list with joins
router.get('/', (req, res) => {
  try {
    const { q, status } = req.query;
    let sql = `
      SELECT t.*,
             m.name AS member_name, m.id AS member_display_id,
             b.title AS book_title, b.author AS book_author, b.isbn AS book_isbn
      FROM transactions t
      JOIN members m ON m.id = t.member_id
      JOIN books   b ON b.id = t.book_id
      WHERE 1=1
    `;
    const params = [];

    if (q) {
      sql += ' AND (m.name LIKE ? OR b.title LIKE ? OR t.id LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    sql += ' ORDER BY t.borrow_date DESC';
    let rows = db.prepare(sql).all(...params);

    // Attach computed fine and resolved status
    rows = rows.map(r => ({
      ...r,
      status: resolveStatus(r),
      fine: calcFine(r.due_date, r.return_date),
    }));

    // Filter by status after computing
    if (status) rows = rows.filter(r => r.status === status);

    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/transactions/stats — dashboard stats
router.get('/stats', (req, res) => {
  try {
    const totalBooks   = db.prepare('SELECT SUM(copies) AS n FROM books').get().n || 0;
    const totalMembers = db.prepare('SELECT COUNT(*) AS n FROM members').get().n;
    const available    = db.prepare('SELECT SUM(available) AS n FROM books').get().n || 0;
    const borrowed     = db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE return_date IS NULL").get().n;

    const allActive = db.prepare("SELECT due_date FROM transactions WHERE return_date IS NULL").all();
    const now = new Date();
    const overdue = allActive.filter(t => new Date(t.due_date) < now).length;

    const fineRows = db.prepare("SELECT due_date FROM transactions WHERE return_date IS NULL").all();
    const pendingFines = fineRows.reduce((sum, t) => sum + calcFine(t.due_date, null), 0);

    // Recent activity (last 6)
    const recent = db.prepare(`
      SELECT t.id, t.borrow_date, t.return_date, t.due_date,
             m.name AS member_name, b.title AS book_title
      FROM transactions t
      JOIN members m ON m.id = t.member_id
      JOIN books   b ON b.id  = t.book_id
      ORDER BY t.created_at DESC LIMIT 6
    `).all().map(r => ({ ...r, status: resolveStatus(r) }));

    // Overdue list
    const overdueList = db.prepare(`
      SELECT t.id, t.due_date,
             m.name AS member_name, b.title AS book_title
      FROM transactions t
      JOIN members m ON m.id = t.member_id
      JOIN books   b ON b.id  = t.book_id
      WHERE t.return_date IS NULL AND date(t.due_date) < date('now')
      ORDER BY t.due_date ASC
    `).all().map(r => ({ ...r, fine: calcFine(r.due_date, null) }));

    res.json({
      success: true,
      data: { totalBooks, totalMembers, available, borrowed, overdue, pendingFines: +pendingFines.toFixed(2), recent, overdueList }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/transactions — borrow a book
router.post('/', (req, res) => {
  try {
    const { memberId, bookId, days } = req.body;
    if (!memberId || !bookId) {
      return res.status(400).json({ success: false, error: 'Member and book are required.' });
    }

    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
    if (!member) return res.status(404).json({ success: false, error: 'Member not found.' });

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
    if (!book) return res.status(404).json({ success: false, error: 'Book not found.' });
    if (book.available < 1) return res.status(400).json({ success: false, error: 'No copies available.' });

    // Check member doesn't already have this book
    const alreadyBorrowed = db.prepare(
      'SELECT id FROM transactions WHERE member_id = ? AND book_id = ? AND return_date IS NULL'
    ).get(memberId, bookId);
    if (alreadyBorrowed) {
      return res.status(400).json({ success: false, error: 'Member already has this book.' });
    }

    const loanDays = parseInt(days) || 14;
    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + loanDays);

    const id = nextTxnId();
    const borrowDate = today.toISOString().split('T')[0];
    const dueDate = due.toISOString().split('T')[0];

    const issueTxn = db.transaction(() => {
      db.prepare(
        'INSERT INTO transactions (id, member_id, book_id, borrow_date, due_date, status) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, memberId, bookId, borrowDate, dueDate, 'Borrowed');
      db.prepare('UPDATE books SET available = available - 1 WHERE id = ?').run(bookId);
    });
    issueTxn();

    const txn = db.prepare(`
      SELECT t.*, m.name AS member_name, b.title AS book_title
      FROM transactions t
      JOIN members m ON m.id = t.member_id
      JOIN books   b ON b.id  = t.book_id
      WHERE t.id = ?
    `).get(id);

    res.status(201).json({ success: true, data: { ...txn, status: 'Borrowed', fine: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/transactions/:id/return — return a book
router.put('/:id/return', (req, res) => {
  try {
    const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    if (!txn) return res.status(404).json({ success: false, error: 'Transaction not found.' });
    if (txn.return_date) return res.status(400).json({ success: false, error: 'Book already returned.' });

    const returnDate = new Date().toISOString().split('T')[0];
    const fine = calcFine(txn.due_date, returnDate);

    const returnTxn = db.transaction(() => {
      db.prepare(
        "UPDATE transactions SET return_date = ?, status = 'Returned' WHERE id = ?"
      ).run(returnDate, req.params.id);
      db.prepare('UPDATE books SET available = available + 1 WHERE id = ?').run(txn.book_id);
    });
    returnTxn();

    res.json({ success: true, data: { returnDate, fine } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

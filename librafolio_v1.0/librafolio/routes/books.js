const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/books — list with optional search/filter
router.get('/', (req, res) => {
  try {
    const { q, genre, status } = req.query;
    let sql = 'SELECT * FROM books WHERE 1=1';
    const params = [];

    if (q) {
      sql += ' AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (genre) {
      sql += ' AND genre = ?';
      params.push(genre);
    }
    if (status === 'Available') {
      sql += ' AND available > 0';
    } else if (status === 'Borrowed') {
      sql += ' AND available < copies';
    }

    sql += ' ORDER BY title ASC';
    const books = db.prepare(sql).all(...params);
    res.json({ success: true, data: books, total: books.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/books/:id
router.get('/:id', (req, res) => {
  try {
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
    if (!book) return res.status(404).json({ success: false, error: 'Book not found' });
    res.json({ success: true, data: book });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/books — add a new book
router.post('/', (req, res) => {
  try {
    const { title, author, isbn, genre, copies, year } = req.body;
    if (!title || !author) {
      return res.status(400).json({ success: false, error: 'Title and author are required.' });
    }
    const c = parseInt(copies) || 1;
    const stmt = db.prepare(
      'INSERT INTO books (title, author, isbn, genre, copies, available, year) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      title.trim(),
      author.trim(),
      isbn || null,
      genre || 'General',
      c, c,
      year ? parseInt(year) : null
    );
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: book });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/books/:id — update book
router.put('/:id', (req, res) => {
  try {
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
    if (!book) return res.status(404).json({ success: false, error: 'Book not found' });

    const { title, author, isbn, genre, copies, year } = req.body;
    db.prepare(
      'UPDATE books SET title=?, author=?, isbn=?, genre=?, copies=?, year=? WHERE id=?'
    ).run(
      title || book.title,
      author || book.author,
      isbn !== undefined ? isbn : book.isbn,
      genre || book.genre,
      copies ? parseInt(copies) : book.copies,
      year ? parseInt(year) : book.year,
      req.params.id
    );
    const updated = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/books/:id
router.delete('/:id', (req, res) => {
  try {
    const inUse = db.prepare(
      "SELECT COUNT(*) AS c FROM transactions WHERE book_id = ? AND return_date IS NULL"
    ).get(req.params.id).c;
    if (inUse > 0) {
      return res.status(400).json({ success: false, error: 'Cannot remove: this book has active loans.' });
    }
    const result = db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Book not found' });
    res.json({ success: true, message: 'Book removed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

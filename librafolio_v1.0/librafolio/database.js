const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'librafolio.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── CREATE TABLES ──────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT NOT NULL,
    author    TEXT NOT NULL,
    isbn      TEXT,
    genre     TEXT DEFAULT 'General',
    copies    INTEGER DEFAULT 1,
    available INTEGER DEFAULT 1,
    year      INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS members (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    email     TEXT UNIQUE NOT NULL,
    phone     TEXT,
    type      TEXT DEFAULT 'Student',
    joined    TEXT DEFAULT (date('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          TEXT PRIMARY KEY,
    member_id   TEXT NOT NULL REFERENCES members(id),
    book_id     INTEGER NOT NULL REFERENCES books(id),
    borrow_date TEXT NOT NULL,
    due_date    TEXT NOT NULL,
    return_date TEXT,
    status      TEXT DEFAULT 'Borrowed',
    created_at  TEXT DEFAULT (datetime('now'))
  );
`);

// ─── SEED DATA (only if tables are empty) ──────────────
const bookCount = db.prepare('SELECT COUNT(*) AS c FROM books').get().c;
if (bookCount === 0) {
  const insertBook = db.prepare(
    'INSERT INTO books (title, author, isbn, genre, copies, available, year) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const seedBooks = db.transaction(() => {
    insertBook.run('To Kill a Mockingbird', 'Harper Lee', '978-0061935466', 'Fiction', 3, 3, 1960);
    insertBook.run('A Brief History of Time', 'Stephen Hawking', '978-0553380163', 'Science', 2, 2, 1988);
    insertBook.run('Sapiens', 'Yuval Noah Harari', '978-0062316097', 'History', 4, 3, 2011);
    insertBook.run('Clean Code', 'Robert C. Martin', '978-0132350884', 'Technology', 2, 1, 2008);
    insertBook.run('The Great Gatsby', 'F. Scott Fitzgerald', '978-0743273565', 'Fiction', 3, 3, 1925);
    insertBook.run('Thinking, Fast and Slow', 'Daniel Kahneman', '978-0374533557', 'Non-Fiction', 2, 2, 2011);
    insertBook.run('1984', 'George Orwell', '978-0451524935', 'Fiction', 4, 2, 1949);
    insertBook.run('The Lean Startup', 'Eric Ries', '978-0307887894', 'Technology', 2, 2, 2011);
    insertBook.run('Meditations', 'Marcus Aurelius', '978-0812968255', 'Philosophy', 2, 2, 180);
    insertBook.run('The Innovators', 'Walter Isaacson', '978-1476708706', 'Biography', 1, 1, 2014);
    insertBook.run('Educated', 'Tara Westover', '978-0399590504', 'Biography', 2, 2, 2018);
    insertBook.run('Atomic Habits', 'James Clear', '978-0735211292', 'Non-Fiction', 3, 2, 2018);
  });
  seedBooks();

  const insertMember = db.prepare(
    'INSERT INTO members (id, name, email, phone, type, joined) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const seedMembers = db.transaction(() => {
    insertMember.run('M001', 'Priya Sharma', 'priya.sharma@email.com', '+91 98765 43210', 'Student', '2024-01-10');
    insertMember.run('M002', 'Arjun Mehta', 'arjun.mehta@email.com', '+91 87654 32109', 'Faculty', '2024-02-05');
    insertMember.run('M003', 'Sunita Patel', 'sunita.patel@email.com', '+91 76543 21098', 'Student', '2024-03-12');
    insertMember.run('M004', 'Rahul Gupta', 'rahul.gupta@email.com', '+91 65432 10987', 'Public', '2024-01-22');
    insertMember.run('M005', 'Anjali Singh', 'anjali.singh@email.com', '+91 54321 09876', 'Staff', '2024-04-01');
  });
  seedMembers();

  const insertTxn = db.prepare(
    'INSERT INTO transactions (id, member_id, book_id, borrow_date, due_date, return_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const seedTxns = db.transaction(() => {
    insertTxn.run('T001', 'M001', 3, '2025-03-20', '2025-04-03', null, 'Borrowed');
    insertTxn.run('T002', 'M002', 4, '2025-03-15', '2025-03-29', null, 'Overdue');
    insertTxn.run('T003', 'M003', 7, '2025-03-18', '2025-04-01', null, 'Overdue');
    insertTxn.run('T004', 'M001', 12, '2025-04-01', '2025-04-15', null, 'Borrowed');
    insertTxn.run('T005', 'M004', 2, '2025-03-05', '2025-03-19', '2025-03-18', 'Returned');
    insertTxn.run('T006', 'M005', 1, '2025-02-10', '2025-02-24', '2025-02-22', 'Returned');
  });
  seedTxns();

  console.log('✅ Database seeded with sample data.');
}

module.exports = db;

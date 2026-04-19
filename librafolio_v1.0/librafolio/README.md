# 📚 LibraFlow — Library Management System

A full-stack Library Management System built with **Node.js + Express** backend and **SQLite** database.

---

## 🗂 Project Structure

```
libraflow/
├── server.js              # Express entry point
├── database.js            # SQLite setup + seed data
├── package.json
├── routes/
│   ├── books.js           # Book CRUD endpoints
│   ├── members.js         # Member CRUD endpoints
│   └── transactions.js    # Borrow / Return / Stats endpoints
└── public/
    └── index.html         # Frontend SPA (served by Express)
```

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Start the server
```bash
npm start
```
Or with auto-reload on file changes:
```bash
npm run dev
```

### 3. Open in browser
```
http://localhost:3000
```

---

## 🔌 REST API Reference

### Books
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/books` | List all books. Query: `q`, `genre`, `status` |
| GET | `/api/books/:id` | Get a single book |
| POST | `/api/books` | Add a book |
| PUT | `/api/books/:id` | Update a book |
| DELETE | `/api/books/:id` | Remove a book |

### Members
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/members` | List all members. Query: `q` |
| GET | `/api/members/:id` | Member detail with active loans |
| POST | `/api/members` | Register a member |
| DELETE | `/api/members/:id` | Remove a member |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List all. Query: `q`, `status` |
| GET | `/api/transactions/stats` | Dashboard stats |
| POST | `/api/transactions` | Borrow a book |
| PUT | `/api/transactions/:id/return` | Return a book |

---

## 📦 Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite via `better-sqlite3`
- **Frontend**: Vanilla HTML/CSS/JS (single-page app served by Express)

---

## 💡 Features
- 📚 Book catalog with search, genre & availability filters
- 👥 Member directory with registration and loan history
- 📖 Borrow & return workflow with configurable loan periods
- ⚠️ Automatic overdue detection and fine calculation ($0.50/day)
- 📊 Live dashboard with stats, recent activity, and overdue alerts
- 🗄️ Persistent SQLite database (auto-created with seed data on first run)

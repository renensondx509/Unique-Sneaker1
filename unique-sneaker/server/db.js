// db.js - initializes sqlite and returns db object
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, 'unique.db');
const db = new Database(dbFile);

const initSql = fs.readFileSync(path.join(__dirname, 'migrations', 'init.sql'), 'utf8');
db.exec(initSql);

// Ensure product exists (Unique limited sneaker)
const product = db.prepare('SELECT * FROM products WHERE name = ?').get('Unique - Limited Edition');
if (!product) {
  const stmt = db.prepare('INSERT INTO products (name, price_cents, total_supply, sold_count) VALUES (?, ?, ?, ?)');
  stmt.run('Unique - Limited Edition', 100000, 7, 0); // 100000 cents = $1000
}

module.exports = db;

-- run automatically by db.js; creates product + orders
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  total_supply INTEGER NOT NULL,
  sold_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_code TEXT,
  stripe_session_id TEXT,
  name TEXT,
  city TEXT,
  city_lat REAL,
  city_lon REAL,
  status TEXT, -- 'pending', 'paid', 'failed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

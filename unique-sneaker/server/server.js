// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const stripeLib = require('stripe');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 4242;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const USER_AGENT = process.env.USER_AGENT || 'UniqueSneakerApp/1.0';

if (!STRIPE_SECRET_KEY) {
  console.warn('WARNING: STRIPE_SECRET_KEY is not set. Stripe integration will fail until you provide keys.');
}

const stripe = stripeLib(STRIPE_SECRET_KEY);

// Helpers
function getProduct() {
  return db.prepare('SELECT * FROM products LIMIT 1').get();
}

function createPendingOrder(name, city, order_code) {
  const stmt = db.prepare('INSERT INTO orders (order_code, name, city, status) VALUES (?, ?, ?, ?)');
  const info = stmt.run(order_code, name, city, 'pending');
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid);
}

// Endpoint: product info
app.get('/api/product', (req, res) => {
  const p = getProduct();
  const available = p.total_supply - p.sold_count;
  res.json({
    id: p.id,
    name: p.name,
    price_cents: p.price_cents,
    price_display: (p.price_cents / 100).toFixed(2),
    total_supply: p.total_supply,
    sold_count: p.sold_count,
    available
  });
});

// Endpoint: create checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { name, city } = req.body;
    if (!name || !city) return res.status(400).json({ error: 'Name and city required' });

    // check availability
    const p = getProduct();
    if (p.sold_count >= p.total_supply) {
      return res.status(400).json({ error: 'Sold out' });
    }

    // create pending order and reserve one
    const order_code = `UQ-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const order = createPendingOrder(name, city, order_code);

    // increment sold_count to reserve
    db.prepare('UPDATE products SET sold_count = sold_count + 1 WHERE id = ?').run(p.id);

    // create stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: p.name, description: 'Unique limited-edition sneaker (1 of 7)' },
            unit_amount: p.price_cents
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${APP_BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_BASE_URL}/cancel.html`,
      metadata: {
        order_id: order.id.toString(),
        order_code: order_code
      }
    });

    // attach stripe_session_id to order (pending)
    db.prepare('UPDATE orders SET stripe_session_id = ? WHERE id = ?').run(session.id, order.id);

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Endpoint: owners list (paid orders only)
app.get('/api/owners', (req, res) => {
  const owners = db.prepare('SELECT id, name, city, city_lat, city_lon, created_at FROM orders WHERE status = ? ORDER BY created_at DESC').all('paid');
  res.json(owners);
});

// Webhook endpoint to mark paid
// Stripe recommends raw body for signature verification, but for simplicity we accept JSON and optional webhook secret
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event = null;
  try {
    if (STRIPE_WEBHOOK_SECRET && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      // If webhook secret not configured (dev), parse body
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // check metadata order_id
    const orderId = session.metadata && session.metadata.order_id;
    if (!orderId) {
      console.warn('No order_id in session metadata');
      return res.json({ received: true });
    }

    // mark order as paid
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      console.warn('Order not found:', orderId);
      return res.json({ received: true });
    }

    // geocode city to lat/lon using Nominatim (if not already)
    (async () => {
      try {
        const q = encodeURIComponent(order.city);
        const nomUrl = `https://nominatim.openstreetmap.org/search?city=${q}&format=json&limit=1`;
        const r = await fetch(nomUrl, { headers: { 'User-Agent': USER_AGENT } });
        const arr = await r.json();
        let lat = null, lon = null;
        if (arr && arr.length > 0) {
          lat = parseFloat(arr[0].lat);
          lon = parseFloat(arr[0].lon);
        }
        db.prepare('UPDATE orders SET status = ?, city_lat = ?, city_lon = ? WHERE id = ?').run('paid', lat, lon, orderId);
        console.log('Order marked paid:', orderId);
      } catch (err) {
        console.error('Geocode error:', err);
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('paid', orderId);
      }
    })();
  }

  res.json({ received: true });
});

// quick health
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
  console.log(`APP_BASE_URL: ${APP_BASE_URL}`);
});

# Unique - Limited Edition (Local dev)

## What this contains
- Node/Express backend (server/) serving API and static frontend
- SQLite database (server/unique.db created on first run)
- Public frontend (public/) with map (Leaflet + OpenStreetMap)
- Stripe Checkout integration (server creates sessions; webhook marks paid)

## Quick start (local)
1. Install Node 18+.
2. In the `server/` folder run `npm install`.
3. Copy `.env.example` to `.env` and fill the keys:
   - STRIPE_SECRET_KEY (from Stripe dashboard)
   - STRIPE_WEBHOOK_SECRET (if you configure webhook)
   - USER_AGENT (set e.g. UniqueSneakerApp/1.0 (your-email@example.com))
4. Run `npm start` from `server/`.
5. Open http://localhost:4242

## Notes
- Only 7 pairs available; price is $1,000 each.
- Geocoding uses Nominatim (OpenStreetMap). Respect their usage policy for heavy traffic.
- This is a basic implementation; for production add TTL cleanup of pending orders, HTTPS, webhook secret verification, and privacy policy.

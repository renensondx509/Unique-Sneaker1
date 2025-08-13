const apiBase = '';

async function loadProduct() {
  const r = await fetch(`${apiBase}/api/product`);
  const p = await r.json();
  document.getElementById('product-name').textContent = p.name;
  document.getElementById('price').textContent = `$${(p.price_cents/100).toFixed(2)}`;
  document.getElementById('available').textContent = p.available;
  if (p.available <= 0) {
    document.getElementById('buy-btn').disabled = true;
    document.getElementById('buy-msg').textContent = 'Sold out';
  }
}

async function loadOwnersAndMap() {
  const r = await fetch(`${apiBase}/api/owners`);
  const owners = await r.json();
  const list = document.getElementById('owners-list');
  list.innerHTML = '';
  owners.forEach(o => {
    const li = document.createElement('li');
    li.textContent = `${o.name} — ${o.city}`;
    list.appendChild(li);
  });

  // Map
  const map = L.map('map').setView([20,0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  owners.forEach(o => {
    if (o.city_lat && o.city_lon) {
      const marker = L.marker([o.city_lat, o.city_lon]).addTo(map);
      marker.bindPopup(`<b>${o.name}</b><br/>${o.city}`);
    }
  });

  // Fit to markers if there are any
  const coords = owners.filter(o => o.city_lat && o.city_lon).map(o => [o.city_lat, o.city_lon]);
  if (coords.length) map.fitBounds(coords, { padding: [40, 40] });
}

document.getElementById('buy-btn').addEventListener('click', async () => {
  const name = document.getElementById('buyer-name').value.trim();
  const city = document.getElementById('buyer-city').value.trim();
  const msg = document.getElementById('buy-msg');
  msg.textContent = '';
  if (!name || !city) { msg.textContent = 'Enter name and city.'; return; }
  try {
    const res = await fetch(`${apiBase}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, city })
    });
    const data = await res.json();
    if (data.error) { msg.textContent = data.error; return; }
    // redirect to stripe checkout (url returned)
    window.location = data.url;
  } catch (err) {
    console.error(err);
    msg.textContent = 'Error creating checkout session';
  }
});

// initial load
loadProduct();
loadOwnersAndMap();

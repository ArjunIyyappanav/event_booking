const $ = (sel) => document.querySelector(sel);
const fmtDate = (s) => new Date(s).toLocaleString();

const screeningsEl = $('#screenings');
const detailsEl = $('#details');
const titleEl = $('#detail-title');
const metaEl = $('#detail-meta');
const seatsEl = $('#seats');
const form = $('#book-form');
const msg = $('#msg');

let currentScreening = null;

async function loadScreenings() {
  const res = await fetch(`${window.location.origin}/api/screenings`);
  const data = await res.json();
  screeningsEl.innerHTML = '';
  data.forEach((s) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = `${fmtDate(s.starts_at)} — ${s.title}`;
    a.addEventListener('click', (e) => { e.preventDefault(); openDetails(s.id); });
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `${s.category} · ${s.min_age}+ · cap ${s.capacity}`;
    li.append(a, badge);
    screeningsEl.appendChild(li);
  });
}

async function openDetails(id) {
  const res = await fetch(`${window.location.origin}/api/screenings/${id}`);
  const data = await res.json();
  currentScreening = data.screening;
  titleEl.textContent = `${currentScreening.title} @ ${fmtDate(currentScreening.starts_at)}`;
  metaEl.textContent = `${currentScreening.category} · ${currentScreening.min_age}+ · ${currentScreening.venue}`;
  drawSeats(currentScreening.capacity, data.seats);
  detailsEl.hidden = false;
}

function drawSeats(capacity, taken) {
  const takenSet = new Set(taken.map((t) => t.seat_number));
  seatsEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= capacity; i++) {
    const div = document.createElement('div');
    div.className = 'seat' + (takenSet.has(i) ? ' taken' : '');
    div.textContent = i;
    frag.appendChild(div);
  }
  seatsEl.appendChild(frag);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentScreening) return;
  msg.textContent = '';
  msg.className = '';

  const payload = {
    screening_id: currentScreening.id,
    seat_numbers: $('#seat_numbers').value
  .split(',')
  .map(n => n.trim())
  .filter(n => n !== '')       // remove empty strings
  .map(n => Number(n))
  .filter(n => !isNaN(n)),     // remove NaN
    buyer_name: $('#buyer_name').value,
    buyer_email: $('#buyer_email').value || null,
    buyer_dob: $('#buyer_dob').value,
    pay_now: $('#pay_now').checked,
  };

  console.log('Booking payload:', payload);
  try {
    const r = await fetch(`${window.location.origin}/api/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed');
    if (data.price !== undefined) msg.textContent = `Success! ${payload.pay_now ? 'Paid' : 'Reserved'} at price ${data.price}`;
    else msg.textContent = `Success! ${payload.pay_now ? 'Paid' : 'Reserved'} successfully.`;
    msg.className = 'success';
    openDetails(currentScreening.id);
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'error';
  }
});

loadScreenings();

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

function fmt(n) {
  return n == null ? '—' : Number(n).toLocaleString();
}

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusPill(status) {
  const cls = `status-${status ?? 'pending'}`;
  return `<span class="status-pill ${cls}">${status ?? 'pending'}</span>`;
}

async function loadStats() {
  try {
    const s = await fetchJSON('/api/stats');
    document.querySelector('#statTotal .stat-num').textContent   = fmt(s.total);
    document.querySelector('#statPages .stat-num').textContent   = fmt(s.with_page);
    document.querySelector('#statSent .stat-num').textContent    = fmt(s.emails_sent);
    document.querySelector('#statReplied .stat-num').textContent = fmt(s.replied);
    document.querySelector('#statConverted .stat-num').textContent = fmt(s.converted);
    document.querySelector('#statCities .stat-num').textContent  =
      s.cities_total ? `${fmt(s.cities_done)}/${fmt(s.cities_total)}` : fmt(s.cities_done);
  } catch (e) {
    console.error('Stats error:', e);
  }
}

async function loadRuns() {
  try {
    const runs = await fetchJSON('/api/runs');
    const el = document.getElementById('runsList');
    if (!runs.length) { el.innerHTML = '<p style="color:var(--muted)">No pipeline runs yet.</p>'; return; }

    el.innerHTML = runs.map(r => `
      <div class="run-item">
        <div class="run-city">${r.city ?? 'Unknown'}</div>
        <div class="run-meta">${timeAgo(r.started_at)}</div>
        <div class="run-stats">
          <span>📍 ${fmt(r.leads_scraped)}</span>
          <span>🌐 ${fmt(r.pages_generated)}</span>
          <span>✉️ ${fmt(r.emails_sent)}</span>
        </div>
        <div style="margin-top:6px">
          <span class="badge badge-${r.status}">${r.status}</span>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Runs error:', e);
  }
}

async function loadLeads() {
  try {
    const leads = await fetchJSON('/api/leads?limit=100');
    const tbody = document.getElementById('leadsBody');
    if (!leads.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted)">No leads yet.</td></tr>';
      return;
    }

    tbody.innerHTML = leads.map(l => `
      <tr>
        <td><strong>${l.business_name}</strong></td>
        <td style="color:var(--muted)">${l.category ?? '—'}</td>
        <td>${l.city ?? '—'}</td>
        <td>${l.phone ?? '—'}</td>
        <td>${fmt(l.reviews)}</td>
        <td>${l.landing_page_url
          ? `<a class="page-link" href="${l.landing_page_url}" target="_blank" rel="noopener">View ↗</a>`
          : '<span style="color:var(--muted)">—</span>'}</td>
        <td>${statusPill(l.outreach_status)}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Leads error:', e);
  }
}

async function loadAll() {
  document.getElementById('refreshBtn').textContent = '↻ Loading…';
  await Promise.all([loadStats(), loadRuns(), loadLeads()]);
  document.getElementById('refreshBtn').textContent = '↻ Refresh';
}

// Initial load + auto-refresh every 60 seconds
loadAll();
setInterval(loadAll, 60000);

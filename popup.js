document.getElementById('optionsLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

function escapeCSVField(value) {
  if (typeof value !== 'string') value = String(value);
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCSV(records) {
  const header = 'cinema,domain,film,date,time';
  const rows = [];
  for (const r of records) {
    for (const time of r.showtimes ?? []) {
      rows.push([r.cinema, r.domain, r.film, r.date, time].map(escapeCSVField).join(','));
    }
  }
  return [header, ...rows].join('\n');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function renderTable(records) {
  const empty = document.getElementById('empty');
  const wrapper = document.getElementById('tableWrapper');
  const tbody = document.getElementById('tableBody');
  const footer = document.getElementById('footer');

  if (!records || records.length === 0) {
    empty.style.display = '';
    wrapper.style.display = 'none';
    footer.textContent = '';
    return;
  }

  empty.style.display = 'none';
  wrapper.style.display = '';

  tbody.innerHTML = '';
  for (const r of records) {
    const tr = document.createElement('tr');
    const cells = [
      { title: r.cinema, text: r.cinema },
      { title: r.film,   text: r.film },
      { title: null,     text: r.date },
      { title: null,     text: (r.showtimes ?? []).join(', ') }
    ];
    for (const { title, text } of cells) {
      const td = document.createElement('td');
      td.textContent = text;
      if (title !== null) td.setAttribute('title', title);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  const totalShowtimes = records.reduce((sum, r) => sum + (r.showtimes ?? []).length, 0);
  footer.textContent = `${records.length} film · ${totalShowtimes} spettacoli`;
}

// Load and render
chrome.storage.local.get(['records'], ({ records }) => {
  renderTable(records ?? []);
});

document.getElementById('downloadCSV').addEventListener('click', () => {
  chrome.storage.local.get(['records'], ({ records }) => {
    if (!records?.length) return;
    const ts = new Date().toISOString().slice(0, 10);
    downloadFile(toCSV(records), `cinema-orari-${ts}.csv`, 'text/csv;charset=utf-8');
  });
});

document.getElementById('downloadJSON').addEventListener('click', () => {
  chrome.storage.local.get(['records'], ({ records }) => {
    if (!records?.length) return;
    const ts = new Date().toISOString().slice(0, 10);
    downloadFile(JSON.stringify(records, null, 2), `cinema-orari-${ts}.json`, 'application/json');
  });
});

document.getElementById('clearData').addEventListener('click', () => {
  chrome.storage.local.set({ records: [] }, () => {
    renderTable([]);
  });
});

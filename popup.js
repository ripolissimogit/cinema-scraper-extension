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

function groupByDomain(records) {
  const groups = {};
  for (const r of records) {
    const key = r.domain || 'sconosciuto';
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return groups;
}

function renderContent(records) {
  const empty = document.getElementById('empty');
  const content = document.getElementById('content');
  const footer = document.getElementById('footer');

  if (!records || records.length === 0) {
    empty.style.display = '';
    content.style.display = 'none';
    footer.textContent = '';
    return;
  }

  empty.style.display = 'none';
  content.style.display = '';
  content.innerHTML = '';

  const groups = groupByDomain(records);
  const ts = new Date().toISOString().slice(0, 10);

  for (const [domain, domainRecords] of Object.entries(groups)) {
    const section = document.createElement('div');
    section.className = 'domain-section';

    // Domain header with per-domain download buttons
    const domainHeader = document.createElement('div');
    domainHeader.className = 'domain-header';

    const nameEl = document.createElement('span');
    nameEl.className = 'domain-name';
    nameEl.textContent = domain;

    const actionsEl = document.createElement('div');
    actionsEl.className = 'domain-actions';

    const csvBtn = document.createElement('button');
    csvBtn.className = 'btn-primary btn-sm';
    csvBtn.textContent = 'CSV';
    csvBtn.addEventListener('click', () => {
      downloadFile(toCSV(domainRecords), `${domain}-${ts}.csv`, 'text/csv;charset=utf-8');
    });

    const jsonBtn = document.createElement('button');
    jsonBtn.className = 'btn-primary btn-sm';
    jsonBtn.textContent = 'JSON';
    jsonBtn.addEventListener('click', () => {
      downloadFile(JSON.stringify(domainRecords, null, 2), `${domain}-${ts}.json`, 'application/json');
    });

    actionsEl.appendChild(csvBtn);
    actionsEl.appendChild(jsonBtn);
    domainHeader.appendChild(nameEl);
    domainHeader.appendChild(actionsEl);

    // Table for this domain
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Cinema</th><th>Film</th><th>Data</th><th>Orari</th></tr>';
    const tbody = document.createElement('tbody');

    for (const r of domainRecords) {
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

    table.appendChild(thead);
    table.appendChild(tbody);
    section.appendChild(domainHeader);
    section.appendChild(table);
    content.appendChild(section);
  }

  const totalShowtimes = records.reduce((sum, r) => sum + (r.showtimes ?? []).length, 0);
  const domainCount = Object.keys(groups).length;
  footer.textContent = `${domainCount} ${domainCount === 1 ? 'sito' : 'siti'} · ${records.length} film · ${totalShowtimes} spettacoli`;
}

// Load and render
chrome.storage.local.get(['records'], ({ records }) => {
  renderContent(records ?? []);
});

document.getElementById('clearData').addEventListener('click', () => {
  chrome.storage.local.set({ records: [] }, () => {
    renderContent([]);
  });
});

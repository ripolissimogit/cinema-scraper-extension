# Cinema Showtime Scraper — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Chrome MV3 extension that detects cinema showtime pages, extracts structured data via LLM, and exports CSV/JSON.

**Architecture:** Content script detects pages and shows a floating button; background service worker holds the API key and calls the LLM; popup displays cumulative results and triggers downloads. Pure logic (detection, export formatting) is extracted into `lib/` for unit testing.

**Tech Stack:** Vanilla JS, Chrome Extension MV3, Node.js built-in test runner (`node --test`), Claude API or OpenAI API.

---

### Task 1: Project Scaffold

**Files:**
- Create: `manifest.json`
- Create: `package.json`
- Create: `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`

**Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Cinema Showtime Scraper",
  "version": "1.0.0",
  "description": "Estrai orari dei cinema da qualsiasi pagina web",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "options_page": "options.html",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**Step 2: Create package.json**

```json
{
  "name": "cinema-scraper-extension",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "node --test tests/**/*.test.js"
  }
}
```

**Step 3: Generate placeholder icons**

Run in terminal:
```bash
mkdir -p icons
# Create minimal valid PNGs with ImageMagick (if available):
# magick -size 16x16 xc:#e74c3c icons/icon16.png
# magick -size 48x48 xc:#e74c3c icons/icon48.png
# magick -size 128x128 xc:#e74c3c icons/icon128.png
# If ImageMagick not available, copy any PNG and rename it — icons are cosmetic.
```

**Step 4: Commit**

```bash
git add manifest.json package.json icons/
git commit -m "feat: project scaffold and manifest"
```

---

### Task 2: Detection Heuristic (`lib/detect.js`)

**Files:**
- Create: `lib/detect.js`
- Create: `tests/detect.test.js`
- Create: `tests/` directory

**Step 1: Write failing tests**

Create `tests/detect.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scorePageText } from '../lib/detect.js';

describe('scorePageText', () => {
  it('returns high score for cinema page text', () => {
    const text = `
      Cinema Spazio Gloria
      Proiezioni della settimana
      Lunedì 17:30 - Giovedì 20:00
      Acquista biglietti
    `;
    assert.ok(scorePageText(text) >= 3);
  });

  it('returns low score for unrelated page text', () => {
    const text = 'Ricette di cucina italiana, pasta al pomodoro, ingredienti freschi';
    assert.ok(scorePageText(text) < 3);
  });

  it('detects time patterns', () => {
    assert.ok(scorePageText('Spettacolo alle 21:30') >= 3);
  });

  it('detects Italian day names', () => {
    assert.ok(scorePageText('Lunedì, Martedì, Mercoledì') >= 3);
  });
});
```

**Step 2: Run to verify failure**

```bash
node --test tests/detect.test.js
```
Expected: `ERR_MODULE_NOT_FOUND` or similar (file doesn't exist yet).

**Step 3: Implement `lib/detect.js`**

```js
const KEYWORDS = [
  'proiezione', 'spettacolo', 'orari', 'programmazione',
  'cinema', 'biglietti', 'sala', 'schermo', 'film'
];

const DAY_NAMES = [
  'lunedì', 'martedì', 'mercoledì', 'giovedì',
  'venerdì', 'sabato', 'domenica'
];

const TIME_PATTERN = /\b\d{2}:\d{2}\b/;

export function scorePageText(text) {
  const lower = text.toLowerCase();
  let score = 0;

  for (const kw of KEYWORDS) {
    if (lower.includes(kw)) score += 1;
  }

  for (const day of DAY_NAMES) {
    if (lower.includes(day)) {
      score += 1;
      break; // count days as a single signal
    }
  }

  if (TIME_PATTERN.test(text)) score += 2;

  return score;
}
```

**Step 4: Run tests to verify pass**

```bash
node --test tests/detect.test.js
```
Expected: all tests pass.

**Step 5: Commit**

```bash
git add lib/detect.js tests/detect.test.js tests/
git commit -m "feat: page detection heuristic with tests"
```

---

### Task 3: Export Formatting (`lib/export.js`)

**Files:**
- Create: `lib/export.js`
- Create: `tests/export.test.js`

**Step 1: Write failing tests**

Create `tests/export.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toCSV, toJSON } from '../lib/export.js';

const RECORDS = [
  {
    cinema: 'Spazio Gloria',
    domain: 'spaziogloria.com',
    film: 'Father Mother Sister Brother',
    date: '2026-03-07',
    showtimes: ['17:00', '20:30']
  }
];

describe('toCSV', () => {
  it('includes header row', () => {
    const csv = toCSV(RECORDS);
    assert.ok(csv.startsWith('cinema,domain,film,date,time'));
  });

  it('expands showtimes into separate rows', () => {
    const csv = toCSV(RECORDS);
    const lines = csv.trim().split('\n');
    // 1 header + 2 showtimes = 3 lines
    assert.equal(lines.length, 3);
  });

  it('quotes fields containing commas', () => {
    const records = [{ ...RECORDS[0], film: 'Film, with comma', showtimes: ['18:00'] }];
    const csv = toCSV(records);
    assert.ok(csv.includes('"Film, with comma"'));
  });
});

describe('toJSON', () => {
  it('returns valid JSON string', () => {
    const json = toJSON(RECORDS);
    assert.doesNotThrow(() => JSON.parse(json));
  });

  it('preserves showtimes as array', () => {
    const parsed = JSON.parse(toJSON(RECORDS));
    assert.deepEqual(parsed[0].showtimes, ['17:00', '20:30']);
  });
});
```

**Step 2: Run to verify failure**

```bash
node --test tests/export.test.js
```
Expected: `ERR_MODULE_NOT_FOUND`.

**Step 3: Implement `lib/export.js`**

```js
function escapeCSVField(value) {
  if (typeof value !== 'string') value = String(value);
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCSV(records) {
  const header = 'cinema,domain,film,date,time';
  const rows = [];

  for (const r of records) {
    for (const time of r.showtimes) {
      rows.push([r.cinema, r.domain, r.film, r.date, time].map(escapeCSVField).join(','));
    }
  }

  return [header, ...rows].join('\n');
}

export function toJSON(records) {
  return JSON.stringify(records, null, 2);
}
```

**Step 4: Run tests**

```bash
node --test tests/export.test.js
```
Expected: all pass.

**Step 5: Run all tests**

```bash
node --test tests/**/*.test.js
```
Expected: all pass.

**Step 6: Commit**

```bash
git add lib/export.js tests/export.test.js
git commit -m "feat: CSV and JSON export formatting with tests"
```

---

### Task 4: Options Page

**Files:**
- Create: `options.html`
- Create: `options.js`

**Step 1: Create `options.html`**

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Cinema Scraper — Impostazioni</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 20px; color: #222; }
    h1 { font-size: 1.2rem; margin-bottom: 24px; }
    label { display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.9rem; }
    select, input[type="text"], input[type="password"] {
      width: 100%; padding: 8px 10px; border: 1px solid #ccc;
      border-radius: 6px; font-size: 0.95rem; box-sizing: border-box;
      margin-bottom: 18px;
    }
    button { background: #2563eb; color: white; border: none; padding: 10px 20px;
      border-radius: 6px; cursor: pointer; font-size: 0.95rem; }
    button:hover { background: #1d4ed8; }
    #status { margin-top: 12px; color: #16a34a; font-size: 0.9rem; height: 20px; }
  </style>
</head>
<body>
  <h1>Impostazioni</h1>

  <label for="provider">Provider LLM</label>
  <select id="provider">
    <option value="claude">Claude (Anthropic)</option>
    <option value="openai">OpenAI</option>
  </select>

  <label for="apiKey">API Key</label>
  <input type="password" id="apiKey" placeholder="sk-..." autocomplete="off">

  <button id="save">Salva</button>
  <div id="status"></div>

  <script src="options.js"></script>
</body>
</html>
```

**Step 2: Create `options.js`**

```js
const providerEl = document.getElementById('provider');
const apiKeyEl = document.getElementById('apiKey');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');

// Load saved settings
chrome.storage.sync.get(['provider', 'apiKey'], ({ provider, apiKey }) => {
  if (provider) providerEl.value = provider;
  if (apiKey) apiKeyEl.value = apiKey;
});

saveBtn.addEventListener('click', () => {
  const provider = providerEl.value;
  const apiKey = apiKeyEl.value.trim();

  if (!apiKey) {
    statusEl.textContent = 'Inserisci una API key.';
    statusEl.style.color = '#dc2626';
    return;
  }

  chrome.storage.sync.set({ provider, apiKey }, () => {
    statusEl.textContent = 'Salvato.';
    statusEl.style.color = '#16a34a';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  });
});
```

**Step 3: Manual test**
- Load extension in Chrome (`chrome://extensions` → Load unpacked → select project folder)
- Right-click extension icon → Options
- Select provider, enter a test key, click Salva
- Verify "Salvato." appears, reopen options, verify values persist

**Step 4: Commit**

```bash
git add options.html options.js
git commit -m "feat: options page for LLM provider and API key"
```

---

### Task 5: Background Service Worker

**Files:**
- Create: `background.js`

**Step 1: Create `background.js`**

```js
const LLM_CONFIGS = {
  claude: {
    url: 'https://api.anthropic.com/v1/messages',
    buildBody: (text, model) => ({
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildPrompt(text) }]
    }),
    buildHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }),
    extractText: (data) => data.content?.[0]?.text ?? ''
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    buildBody: (text, model) => ({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: buildPrompt(text) }],
      max_tokens: 2048
    }),
    buildHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }),
    extractText: (data) => data.choices?.[0]?.message?.content ?? ''
  }
};

function buildPrompt(pageText) {
  return `Analizza il seguente testo di una pagina web di un cinema e restituisci un array JSON con gli orari degli spettacoli.

Ogni elemento dell'array deve avere questa struttura:
{
  "cinema": "nome del cinema",
  "domain": "dominio del sito (es. spaziogloria.com)",
  "film": "titolo del film",
  "date": "data in formato YYYY-MM-DD",
  "showtimes": ["HH:MM", "HH:MM"]
}

Regole:
- Restituisci SOLO il JSON, senza testo aggiuntivo, senza markdown
- Se la data non è specificata esplicitamente, usa il contesto (es. "questa settimana") per dedurla
- Se non riesci a trovare orari, restituisci un array vuoto []
- Raggruppa per film e data

Testo della pagina:
---
${pageText.slice(0, 8000)}
---`;
}

function parseJSON(text) {
  // Strip markdown code blocks if present
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'EXTRACT') return;

  chrome.storage.sync.get(['provider', 'apiKey'], async ({ provider, apiKey }) => {
    if (!provider || !apiKey) {
      sendResponse({ error: 'API key non configurata. Vai alle impostazioni.' });
      return;
    }

    const config = LLM_CONFIGS[provider];
    if (!config) {
      sendResponse({ error: `Provider non supportato: ${provider}` });
      return;
    }

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: config.buildHeaders(apiKey),
        body: JSON.stringify(config.buildBody(message.text))
      });

      if (!response.ok) {
        const err = await response.text();
        sendResponse({ error: `API error ${response.status}: ${err.slice(0, 200)}` });
        return;
      }

      const data = await response.json();
      const rawText = config.extractText(data);
      const records = parseJSON(rawText);

      // Store cumulatively
      chrome.storage.local.get(['records'], ({ records: existing }) => {
        const updated = [...(existing ?? []), ...records];
        chrome.storage.local.set({ records: updated }, () => {
          sendResponse({ ok: true, count: records.length });
        });
      });

    } catch (err) {
      sendResponse({ error: err.message });
    }
  });

  return true; // keep channel open for async response
});
```

**Step 2: Manual test (deferred to Task 7)**

**Step 3: Commit**

```bash
git add background.js
git commit -m "feat: background service worker with Claude and OpenAI support"
```

---

### Task 6: Content Script

**Files:**
- Create: `content.js`

**Step 1: Create `content.js`**

```js
// Inline detection logic (can't import ES modules in content scripts without bundler)
const KEYWORDS = [
  'proiezione', 'spettacolo', 'orari', 'programmazione',
  'cinema', 'biglietti', 'sala', 'schermo', 'film'
];
const DAY_NAMES = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const TIME_PATTERN = /\b\d{2}:\d{2}\b/;

function scorePageText(text) {
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of KEYWORDS) if (lower.includes(kw)) score += 1;
  for (const day of DAY_NAMES) { if (lower.includes(day)) { score += 1; break; } }
  if (TIME_PATTERN.test(text)) score += 2;
  return score;
}

function injectButton() {
  if (document.getElementById('cinema-scraper-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'cinema-scraper-btn';
  btn.textContent = '🎬 Estrai orari';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '999999',
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '14px',
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    transition: 'opacity 0.2s'
  });

  btn.addEventListener('click', handleExtract);
  document.body.appendChild(btn);
}

function showNotification(message, isError = false) {
  const note = document.createElement('div');
  note.textContent = message;
  Object.assign(note.style, {
    position: 'fixed',
    bottom: '70px',
    right: '20px',
    zIndex: '999999',
    background: isError ? '#dc2626' : '#16a34a',
    color: 'white',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '13px',
    fontFamily: 'system-ui, sans-serif',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
  });
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 3500);
}

async function handleExtract() {
  const btn = document.getElementById('cinema-scraper-btn');
  btn.textContent = '⏳ Estrazione…';
  btn.disabled = true;

  const text = document.body.innerText;

  chrome.runtime.sendMessage({ type: 'EXTRACT', text }, (response) => {
    btn.textContent = '🎬 Estrai orari';
    btn.disabled = false;

    if (chrome.runtime.lastError) {
      showNotification('Errore di comunicazione con l\'estensione.', true);
      return;
    }

    if (response.error) {
      showNotification(`Errore: ${response.error}`, true);
    } else {
      showNotification(`✓ Trovati ${response.count} spettacoli`);
    }
  });
}

// Auto-detect on load
const pageScore = scorePageText(document.body.innerText);
if (pageScore >= 3) {
  injectButton();
}
```

**Step 2: Manual test (deferred to Task 7)**

**Step 3: Commit**

```bash
git add content.js
git commit -m "feat: content script with auto-detection and floating button"
```

---

### Task 7: Popup

**Files:**
- Create: `popup.html`
- Create: `popup.js`

**Step 1: Create `popup.html`**

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Cinema Scraper</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, sans-serif;
      width: 420px;
      min-height: 200px;
      color: #1a1a1a;
    }
    header {
      background: #2563eb;
      color: white;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    header h1 { font-size: 0.95rem; font-weight: 600; }
    header a { color: rgba(255,255,255,0.75); font-size: 0.8rem; text-decoration: none; }
    header a:hover { color: white; }
    .actions {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
    }
    button {
      padding: 7px 14px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .btn-primary { background: #2563eb; color: white; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
    .btn-secondary:hover { background: #e5e7eb; }
    .btn-danger { background: #fee2e2; color: #dc2626; }
    .btn-danger:hover { background: #fecaca; }
    #empty {
      text-align: center;
      padding: 40px 20px;
      color: #9ca3af;
      font-size: 0.9rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }
    th {
      background: #f9fafb;
      text-align: left;
      padding: 8px 10px;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #6b7280;
      border-bottom: 1px solid #e5e7eb;
      position: sticky;
      top: 0;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #f3f4f6;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f9fafb; }
    #tableWrapper { max-height: 320px; overflow-y: auto; }
    footer {
      padding: 8px 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 0.78rem;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <header>
    <h1>🎬 Cinema Scraper</h1>
    <a id="optionsLink" href="#">Impostazioni</a>
  </header>

  <div class="actions">
    <button class="btn-primary" id="downloadCSV">Download CSV</button>
    <button class="btn-primary" id="downloadJSON">Download JSON</button>
    <button class="btn-danger" id="clearData">Cancella tutto</button>
  </div>

  <div id="empty">Nessun dato estratto.<br>Visita una pagina di cinema e clicca il pulsante 🎬.</div>

  <div id="tableWrapper" style="display:none">
    <table>
      <thead>
        <tr>
          <th>Cinema</th>
          <th>Film</th>
          <th>Data</th>
          <th>Orari</th>
        </tr>
      </thead>
      <tbody id="tableBody"></tbody>
    </table>
  </div>

  <footer id="footer"></footer>

  <script src="popup.js"></script>
</body>
</html>
```

**Step 2: Create `popup.js`**

```js
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
    for (const time of r.showtimes) {
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
  URL.revokeObjectURL(url);
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
    tr.innerHTML = `
      <td title="${r.cinema}">${r.cinema}</td>
      <td title="${r.film}">${r.film}</td>
      <td>${r.date}</td>
      <td>${r.showtimes.join(', ')}</td>
    `;
    tbody.appendChild(tr);
  }

  const totalShowtimes = records.reduce((sum, r) => sum + r.showtimes.length, 0);
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
```

**Step 3: Commit**

```bash
git add popup.html popup.js
git commit -m "feat: popup with table view and CSV/JSON download"
```

---

### Task 8: End-to-End Manual Test

**Step 1: Load the extension**
1. Open `chrome://extensions`
2. Enable "Developer mode" (toggle top-right)
3. Click "Load unpacked" → select the `cinema-scraper-extension/` folder
4. Verify the extension loads with no errors

**Step 2: Configure API key**
1. Right-click extension icon → "Impostazioni"
2. Select provider, enter a valid API key
3. Click Salva → verify "Salvato." appears

**Step 3: Test detection on the example page**
1. Navigate to `https://www.spaziogloria.com/events/father-mother-sister-brother-di-jim-jarmusch`
2. Verify the floating "🎬 Estrai orari" button appears in the bottom-right
3. Click it → verify spinner text "⏳ Estrazione…" appears
4. After response: verify green notification with count of showtimes found

**Step 4: Test popup**
1. Click extension icon → popup opens
2. Verify table shows extracted records
3. Click "Download CSV" → verify file downloads with correct columns
4. Click "Download JSON" → verify valid JSON with correct structure
5. Click "Cancella tutto" → table clears

**Step 5: Test on a non-cinema page**
1. Navigate to any news or cooking page
2. Verify the floating button does NOT appear

**Step 6: Final commit**

```bash
git add .
git commit -m "chore: verify end-to-end flow complete"
```

---

### Task 9: Run All Unit Tests

**Step 1:**

```bash
node --test tests/detect.test.js tests/export.test.js
```

Expected output: all tests pass with no failures.

**Step 2: If any test fails**, investigate and fix before proceeding.

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: correct failing unit tests"
```

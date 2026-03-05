# Cinema Showtime Scraper — Design

**Date:** 2026-03-05
**Target:** Chrome Extension (Manifest V3)

## Goal

Extract cinema showtime data from any Italian cinema website and export it as CSV and JSON.

## Data Structure

Each extracted record contains:
- `cinema` — name of the cinema
- `domain` — website domain (e.g. `spaziogloria.com`)
- `film` — title of the film
- `date` — showtime date (ISO 8601: `YYYY-MM-DD`)
- `showtimes` — array of times (e.g. `["17:00", "20:30"]`)

## Architecture

Vanilla JS Chrome Extension MV3, no framework. Three components:

### 1. Content Script (`content.js`)
- Injected into all pages
- On page load: scans text for cinema-related keywords and time patterns to detect showtime pages
- If detected: injects a floating "Estrai orari" button into the page
- On button click: extracts `document.body.innerText`, sends to background worker
- Receives result back, shows success/error notification in page

### 2. Background Service Worker (`background.js`)
- Holds API key securely (not exposed to content script)
- Receives text from content script via `chrome.runtime.sendMessage`
- Calls configured LLM API with structured prompt
- Returns parsed JSON result to content script
- Stores cumulative results in `chrome.storage.local`

### 3. Popup + Options Page
- **Popup** (`popup.html/js`): shows table of all extracted records, Download CSV, Download JSON buttons
- **Options** (`options.html/js`): configure LLM provider (Claude / OpenAI), API key, model

## Detection Heuristic

Score-based keyword matching on `document.body.innerText`:
- Keywords: proiezione, spettacolo, orari, programmazione, cinema, biglietti, sala
- Patterns: `\d{2}:\d{2}`, day names (lunedì…), month names (gennaio…)
- Threshold: score ≥ 3 → show floating button

## LLM Extraction

Prompt instructs the model to return a JSON array:
```json
[
  {
    "cinema": "Spazio Gloria",
    "domain": "spaziogloria.com",
    "film": "Father Mother Sister Brother",
    "date": "2026-03-07",
    "showtimes": ["17:00", "20:30"]
  }
]
```

Supported providers (user-configured in Options):
- **Claude** — `claude-haiku-4-5-20251001` (default)
- **OpenAI** — `gpt-4o-mini`

## Data Storage & Export

- Results stored cumulatively in `chrome.storage.local` (survives across tabs/sessions)
- Popup allows clearing all data
- **CSV**: one row per showtime (`cinema, domain, film, date, time`)
- **JSON**: array of records with `showtimes` as array

## File Structure

```
cinema-scraper-extension/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── options.html
├── options.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── docs/
    └── plans/
        └── 2026-03-05-cinema-scraper-design.md
```

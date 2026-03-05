(function () {
  if (window.__cinemaScraper) return;
  window.__cinemaScraper = true;

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
    // Each day name contributes independently — multiple days signal a schedule
    for (const day of DAY_NAMES) { if (lower.includes(day)) score += 1; }
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
      zIndex: '2147483647',
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
      zIndex: '2147483647',
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

      if (!response || response.error) {
        showNotification(`Errore: ${response?.error ?? 'Risposta non ricevuta'}`, true);
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
})();

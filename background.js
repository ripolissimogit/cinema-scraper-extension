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
      model: model || 'gpt-4o',
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
  const today = new Date().toISOString().slice(0, 10);
  return `Oggi è ${today}. Analizza il seguente testo di una pagina web di un cinema e restituisci un array JSON con gli orari degli spettacoli.

Ogni elemento dell'array deve avere questa struttura:
{
  "cinema": "nome del cinema",
  "domain": "dominio del sito (es. spaziogloria.com)",
  "film": "titolo del film",
  "date": "data in formato YYYY-MM-DD",
  "showtimes": ["HH:MM", "HH:MM"]
}

Regole IMPORTANTI:
- Restituisci SOLO il JSON, senza testo aggiuntivo, senza markdown
- Le date devono essere reali: usa la data odierna (${today}) come riferimento per interpretare "oggi", "domani", "questa settimana"
- Estrai SOLO orari effettivamente presenti nel testo — non inventare orari
- Se un dato non è presente nel testo, ometti il record invece di inventarlo
- Se non trovi orari, restituisci []
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

// Push result back to the tab — avoids MV3 service worker keepalive issues
function replyToTab(tabId, result) {
  chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_RESULT', ...result });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== 'EXTRACT') return;

  const tabId = sender.tab?.id;
  if (!tabId) return;

  // Fire-and-forget async work; result is pushed back via tabs.sendMessage
  (async () => {
    const { provider, apiKey } = await chrome.storage.sync.get(['provider', 'apiKey']);

    if (!provider || !apiKey) {
      replyToTab(tabId, { error: 'API key non configurata. Vai alle impostazioni.' });
      return;
    }

    const config = LLM_CONFIGS[provider];
    if (!config) {
      replyToTab(tabId, { error: `Provider non supportato: ${provider}` });
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
        replyToTab(tabId, { error: `API error ${response.status}: ${err.slice(0, 200)}` });
        return;
      }

      const data = await response.json();
      const rawText = config.extractText(data);
      if (!rawText) throw new Error('Il modello ha restituito una risposta vuota');
      const records = parseJSON(rawText);
      if (!Array.isArray(records)) throw new Error('Risposta LLM non è un array JSON valido');

      // Override domain with the real hostname from the page
      const realDomain = message.domain || '';
      const normalized = records.map(r => ({ ...r, domain: realDomain }));

      const { records: existing } = await chrome.storage.local.get(['records']);
      const updated = [...(existing ?? []), ...normalized];
      await chrome.storage.local.set({ records: updated });

      replyToTab(tabId, { ok: true, count: records.length });
    } catch (err) {
      replyToTab(tabId, { error: err.message });
    }
  })();
});

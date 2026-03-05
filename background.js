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
      if (!rawText) throw new Error('Il modello ha restituito una risposta vuota');
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

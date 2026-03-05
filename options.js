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

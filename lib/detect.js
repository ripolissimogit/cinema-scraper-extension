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
    if (lower.includes(day)) score += 1;
  }

  if (TIME_PATTERN.test(text)) score += 2;

  return score;
}

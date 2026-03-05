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

  it('detects time patterns boosting a keyword match over threshold', () => {
    // "spettacolo" = +1 keyword, "21:30" = +2 time pattern → total 3
    assert.ok(scorePageText('Spettacolo alle 21:30') >= 3);
  });

  it('detects Italian day names', () => {
    assert.ok(scorePageText('Lunedì, Martedì, Mercoledì') >= 3);
  });
});

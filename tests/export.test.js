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

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
    for (const time of r.showtimes ?? []) {
      rows.push([r.cinema, r.domain, r.film, r.date, time].map(escapeCSVField).join(','));
    }
  }

  return [header, ...rows].join('\n');
}

export function toJSON(records) {
  return JSON.stringify(records, null, 2);
}

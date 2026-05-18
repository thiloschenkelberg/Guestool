import { readFileSync, writeFileSync } from 'node:fs';

const CSV_PATH = new URL('../data/besucherliste.csv', import.meta.url);
const OUTPUT_PATH = new URL('../data/guests.js', import.meta.url);

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      const nextCharacter = line[index + 1];
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ';' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  cells.push(current);
  return cells.map(cell => cell.trim());
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildGuests(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean);

  const headers = parseCsvLine(lines[0]);

  return lines
    .slice(1)
    .map((line, index) => {
      const values = parseCsvLine(line);
      const row = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? '']));
      const firstName = row.Vorname ?? '';
      const lastName = row.Nachname ?? '';
      const name = `${firstName} ${lastName}`.trim() || (row.Firma ?? '').trim();

      if (!name) {
        return null;
      }

      const group = [row.Firma, row.Position, row['Begleitperson von']]
        .map(value => value?.trim())
        .filter(Boolean)
        .join(' • ');

      return {
        id: `${index + 1}-${slugify(name)}`,
        name,
        group
      };
    })
    .filter(Boolean);
}

const csvText = readFileSync(CSV_PATH, 'utf8');
const guests = buildGuests(csvText);
const output = `export const guestList = ${JSON.stringify(guests, null, 2)};\n`;

writeFileSync(OUTPUT_PATH, output);
console.log(`Generated ${guests.length} guests in data/guests.js`);

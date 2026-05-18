const GUEST_SOURCE_KEY = 'guest-tool-guest-source-v1';

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

function buildGuestsFromCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

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

function validateGuestList(guestList) {
  if (!Array.isArray(guestList)) {
    throw new Error('Guest list must be an array.');
  }

  guestList.forEach((guest, index) => {
    if (!guest || typeof guest !== 'object') {
      throw new Error(`Guest ${index + 1} is invalid.`);
    }

    if (typeof guest.id !== 'string' || typeof guest.name !== 'string') {
      throw new Error(`Guest ${index + 1} must include id and name.`);
    }
  });

  return guestList;
}

function parseGuestFileContents(fileName, text) {
  if (fileName.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text);
    return validateGuestList(parsed);
  }

  return buildGuestsFromCsv(text);
}

export function saveGuestSource(fileName, text) {
  const guests = parseGuestFileContents(fileName, text);
  const payload = {
    fileName,
    savedAt: new Date().toISOString(),
    guestCount: guests.length,
    guests
  };

  localStorage.setItem(GUEST_SOURCE_KEY, JSON.stringify(payload));
  return payload;
}

export function loadGuestSource() {
  const raw = localStorage.getItem(GUEST_SOURCE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      guests: validateGuestList(parsed.guests ?? [])
    };
  } catch (error) {
    console.error('Could not parse stored guest source', error);
    return null;
  }
}

export function clearGuestSource() {
  localStorage.removeItem(GUEST_SOURCE_KEY);
}

export async function loadGuestsFromDeviceStorage() {
  const source = loadGuestSource();
  if (!source) {
    throw new Error('No guest list has been selected on this device yet.');
  }

  return source.guests;
}

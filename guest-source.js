const GUEST_SOURCE_KEY = 'guest-tool-guest-source-v1';
const PIZZA_SOURCE_KEY = 'guest-tool-pizza-source-v1';

function detectCsvDelimiter(line) {
  const semicolonCount = (line.match(/;/g) ?? []).length;
  const commaCount = (line.match(/,/g) ?? []).length;
  return commaCount > semicolonCount ? ',' : ';';
}

function parseCsvLine(line, delimiter) {
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

    if (character === delimiter && !inQuotes) {
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

function normalizeName(value) {
  return slugify(value ?? '');
}

function buildRowsFromCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const delimiter = detectCsvDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter);

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line, delimiter);
    return {
      rowIndex: index + 1,
      row: Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? '']))
    };
  });
}

function buildGuestsFromRows(rows) {
  return rows
    .map(({ rowIndex, row }) => {
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
        id: `${rowIndex}-${slugify(name)}`,
        name,
        group
      };
    })
    .filter(Boolean);
}

function parseBooleanLike(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (['1', 'true', 'yes', 'y', 'ja', 'x'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'n', 'nein', '-'].includes(normalized)) {
    return false;
  }

  return null;
}

function firstMatchingValue(row, keys) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeName(key), value]);

  for (const key of keys) {
    const match = normalizedEntries.find(([normalizedKey]) => normalizedKey === normalizeName(key));
    if (match && String(match[1] ?? '').trim()) {
      return String(match[1]).trim();
    }
  }

  return '';
}

function buildPizzaName(row) {
  const directName = firstMatchingValue(row, [
    'name',
    'full name',
    'full_name',
    'guest',
    'gast',
    'person'
  ]);

  if (directName) {
    return directName;
  }

  const firstName = firstMatchingValue(row, ['vorname', 'first name', 'firstname', 'first_name']);
  const lastName = firstMatchingValue(row, ['nachname', 'last name', 'lastname', 'last_name']);
  return `${firstName} ${lastName}`.trim();
}

function buildPizzaType(row) {
  const directType = firstMatchingValue(row, [
    'pizza type',
    'pizza_type',
    'pizzatyp',
    'type',
    'sorte',
    'pizza sorte'
  ]);

  if (directType) {
    return directType;
  }

  const pizzaColumn = firstMatchingValue(row, ['pizza', 'pizza status', 'pizza info']);
  const booleanValue = parseBooleanLike(pizzaColumn);

  if (pizzaColumn && booleanValue === null) {
    return pizzaColumn;
  }

  return '';
}

function buildPizzaDayType(row, dayKeys) {
  return firstMatchingValue(row, dayKeys);
}

function buildPizzaEligibility(row, pizzaType) {
  const explicitEligibility = firstMatchingValue(row, [
    'gets pizza',
    'pizza eligible',
    'eligible',
    'has pizza',
    'bekommt pizza',
    'pizza ja nein'
  ]);

  const parsedExplicit = parseBooleanLike(explicitEligibility);
  if (parsedExplicit !== null) {
    return parsedExplicit;
  }

  const pizzaColumn = firstMatchingValue(row, ['pizza', 'pizza status', 'pizza info']);
  const parsedPizzaColumn = parseBooleanLike(pizzaColumn);
  if (parsedPizzaColumn !== null) {
    return parsedPizzaColumn;
  }

  if (pizzaType) {
    return true;
  }

  return true;
}

function resolvePizzaEligibility(row, pizzaType, saturdayType, sundayType) {
  const explicitEligibility = firstMatchingValue(row, [
    'gets pizza',
    'pizza eligible',
    'eligible',
    'has pizza',
    'bekommt pizza',
    'pizza ja nein'
  ]);
  const parsedExplicit = parseBooleanLike(explicitEligibility);

  if (parsedExplicit !== null) {
    return parsedExplicit;
  }

  if (saturdayType || sundayType) {
    return true;
  }

  return buildPizzaEligibility(row, pizzaType);
}

function buildPizzaEntriesFromRows(rows) {
  return rows
    .map(({ rowIndex, row }) => {
      const name = buildPizzaName(row);
      if (!name) {
        return null;
      }

      const saturdayType = buildPizzaDayType(row, [
        'samstag',
        'saturday',
        'samstag pizza',
        'saturday pizza'
      ]);
      const sundayType = buildPizzaDayType(row, [
        'sonntag',
        'sunday',
        'sonntag pizza',
        'sunday pizza'
      ]);
      const pizzaType = buildPizzaType(row) || [saturdayType, sundayType].filter(Boolean).join(' / ');
      const getsPizza = resolvePizzaEligibility(row, pizzaType, saturdayType, sundayType);

      return {
        id: `${rowIndex}-${slugify(name)}`,
        name,
        pizzaType,
        getsPizza,
        saturdayType,
        sundayType
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

function validatePizzaList(pizzaList) {
  if (!Array.isArray(pizzaList)) {
    throw new Error('Pizza list must be an array.');
  }

  return pizzaList.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Pizza entry ${index + 1} is invalid.`);
    }

    if (typeof entry.name !== 'string' || !entry.name.trim()) {
      throw new Error(`Pizza entry ${index + 1} must include a guest name.`);
    }

    const parsedEligibility = parseBooleanLike(
      entry.getsPizza ?? entry.eligible ?? entry.hasPizza ?? entry.pizzaEligible
    );

    return {
      id: typeof entry.id === 'string' && entry.id ? entry.id : `${index + 1}-${slugify(entry.name)}`,
      name: entry.name.trim(),
      pizzaType: String(
        entry.pizzaType ??
        entry.type ??
        [entry.saturdayType ?? entry.samstag ?? entry.saturday, entry.sundayType ?? entry.sonntag ?? entry.sunday]
          .filter(Boolean)
          .join(' / ')
      ).trim(),
      getsPizza: parsedEligibility ?? true,
      saturdayType: String(entry.saturdayType ?? entry.samstag ?? entry.saturday ?? '').trim(),
      sundayType: String(entry.sundayType ?? entry.sonntag ?? entry.sunday ?? '').trim()
    };
  });
}

function parseGuestFileContents(fileName, text) {
  if (fileName.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text);
    return validateGuestList(parsed);
  }

  return buildGuestsFromRows(buildRowsFromCsv(text));
}

function parsePizzaFileContents(fileName, text) {
  if (fileName.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text);
    return validatePizzaList(parsed);
  }

  return validatePizzaList(buildPizzaEntriesFromRows(buildRowsFromCsv(text)));
}

function saveSource(storageKey, fileName, entries, countKey) {
  const payload = {
    fileName,
    savedAt: new Date().toISOString(),
    [countKey]: entries.length,
    entries
  };

  localStorage.setItem(storageKey, JSON.stringify(payload));
  return payload;
}

function loadSource(storageKey, validator, countKey, entryKey) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const entries = validator(parsed.entries ?? parsed[entryKey] ?? []);
    return {
      ...parsed,
      [countKey]: entries.length,
      entries
    };
  } catch (error) {
    console.error(`Could not parse stored source for ${storageKey}`, error);
    return null;
  }
}

export function saveGuestSource(fileName, text) {
  return saveSource(GUEST_SOURCE_KEY, fileName, parseGuestFileContents(fileName, text), 'guestCount');
}

export function loadGuestSource() {
  return loadSource(GUEST_SOURCE_KEY, validateGuestList, 'guestCount', 'guests');
}

export function clearGuestSource() {
  localStorage.removeItem(GUEST_SOURCE_KEY);
}

export async function loadGuestsFromDeviceStorage() {
  const source = loadGuestSource();
  if (!source) {
    throw new Error('No guest list has been selected on this device yet.');
  }

  return source.entries;
}

export function savePizzaSource(fileName, text) {
  return saveSource(PIZZA_SOURCE_KEY, fileName, parsePizzaFileContents(fileName, text), 'pizzaCount');
}

export function loadPizzaSource() {
  return loadSource(PIZZA_SOURCE_KEY, validatePizzaList, 'pizzaCount', 'pizzaEntries');
}

export function clearPizzaSource() {
  localStorage.removeItem(PIZZA_SOURCE_KEY);
}

export async function loadPizzaGuestsFromDeviceStorage() {
  const pizzaSource = loadPizzaSource();
  if (!pizzaSource) {
    throw new Error('No pizza list has been selected on this device yet.');
  }

  const guestSource = loadGuestSource();
  const guestsByName = new Map(
    (guestSource?.entries ?? []).map(guest => [normalizeName(guest.name), guest])
  );

  return pizzaSource.entries
    .filter(entry => entry.getsPizza)
    .map(entry => {
      const matchedGuest = guestsByName.get(normalizeName(entry.name));
      return {
        id: matchedGuest?.id ?? `pizza-${entry.id}`,
        name: matchedGuest?.name ?? entry.name,
        group: matchedGuest?.group ?? '',
        pizzaType: entry.pizzaType,
        saturdayType: entry.saturdayType,
        sundayType: entry.sundayType
      };
    });
}

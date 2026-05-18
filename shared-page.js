async function defaultGuestLoader() {
  return [];
}

export async function createGuestPage(config) {
  const elements = {
    guestList: document.getElementById('guestList'),
    searchInput: document.getElementById('searchInput'),
    totalCount: document.getElementById('totalCount'),
    shownCount: document.getElementById('shownCount'),
    doneCount: document.getElementById('doneCount'),
    emptyState: document.getElementById('emptyState'),
    listHeader: document.getElementById('listHeader')
  };

  const fields = config.fields ?? [];
  const loadGuestSource =
    config.loadGuests ??
    (async () => config.guests ?? defaultGuestLoader());

  const state = {
    guests: [],
    search: ''
  };

  function cloneGuests(list) {
    return list.map(item => ({ ...item }));
  }

  function normalizeGuests(seedGuests) {
    return seedGuests.map(guest => {
      const normalized = { ...guest };

      fields.forEach(field => {
        normalized[field.key] = Boolean(normalized[field.key]);
      });

      return normalized;
    });
  }

  function mergeGuests(seedGuests, savedGuests) {
    if (!Array.isArray(savedGuests)) {
      return normalizeGuests(seedGuests);
    }

    const savedById = new Map(savedGuests.map(guest => [guest.id, guest]));

    return normalizeGuests(seedGuests).map(guest => {
      const savedGuest = savedById.get(guest.id);
      if (!savedGuest) {
        return guest;
      }

      const mergedGuest = { ...guest };
      fields.forEach(field => {
        mergedGuest[field.key] = Boolean(savedGuest[field.key]);
      });
      return mergedGuest;
    });
  }

  function loadStoredGuests(seedGuests, storageKey) {
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      return cloneGuests(normalizeGuests(seedGuests));
    }

    try {
      const parsed = JSON.parse(saved);
      return cloneGuests(mergeGuests(seedGuests, parsed));
    } catch {
      return cloneGuests(normalizeGuests(seedGuests));
    }
  }

  function saveGuests() {
    localStorage.setItem(config.storageKey, JSON.stringify(state.guests));
  }

  function getFilteredGuests() {
    const query = state.search.trim().toLowerCase();
    if (!query) {
      return state.guests;
    }

    return state.guests.filter(guest => {
      const group = guest.group ?? '';
      return guest.name.toLowerCase().includes(query) || group.toLowerCase().includes(query);
    });
  }

  function isDone(guest) {
    if (typeof config.isDone === 'function') {
      return config.isDone(guest);
    }

    return fields.some(field => Boolean(guest[field.key]));
  }

  function updateStats(filteredGuests) {
    elements.totalCount.textContent = String(state.guests.length);
    elements.shownCount.textContent = String(filteredGuests.length);
    elements.doneCount.textContent = String(state.guests.filter(isDone).length);
  }

  function updateGuest(id, fieldKey, checked) {
    const guest = state.guests.find(item => item.id === id);
    if (!guest) {
      return;
    }

    guest[fieldKey] = checked;
    saveGuests();
    render();
  }

  function createRow(guest) {
    const row = document.createElement('article');
    row.className = 'guestRow';
    if (config.rowClassName) {
      row.classList.add(config.rowClassName);
    }

    const info = document.createElement('div');

    const name = document.createElement('div');
    name.className = 'guestName';
    name.textContent = guest.name;

    const meta = document.createElement('div');
    meta.className = 'guestMeta';
    const metaText = typeof config.getMetaText === 'function'
      ? config.getMetaText(guest)
      : (guest.group || 'Guest list');
    meta.textContent = metaText;
    meta.style.display = metaText ? '' : 'none';

    info.append(name, meta);

    const actions = document.createElement('div');
    actions.className = 'actions';
    if (config.actionsClassName) {
      actions.classList.add(config.actionsClassName);
    }

    fields.forEach(field => {
      const fieldWrapper = document.createElement('div');
      fieldWrapper.className = 'fieldCell';

      const label = document.createElement('label');
      label.className = 'control';

      const disabled = typeof field.isDisabled === 'function'
        ? Boolean(field.isDisabled(guest))
        : Boolean(field.disabled);
      if (disabled) {
        label.classList.add('controlDisabled');
      }

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(guest[field.key]);
      checkbox.disabled = disabled;
      checkbox.addEventListener('change', () => updateGuest(guest.id, field.key, checkbox.checked));

      const text = document.createElement('span');
      text.textContent = typeof field.getLabel === 'function'
        ? field.getLabel(guest)
        : field.label;

      label.append(checkbox, text);
      fieldWrapper.append(label);

      if (config.renderFieldsAsColumns) {
        row.append(fieldWrapper);
      } else {
        actions.append(fieldWrapper);
      }
    });

    row.prepend(info);

    if (!config.renderFieldsAsColumns) {
      row.append(actions);
    }

    return row;
  }

  function render() {
    const filteredGuests = getFilteredGuests();
    elements.guestList.innerHTML = '';

    filteredGuests.forEach(guest => {
      elements.guestList.appendChild(createRow(guest));
    });

    elements.emptyState.style.display = filteredGuests.length ? 'none' : 'block';
    updateStats(filteredGuests);
  }

  function renderHeader() {
    if (!elements.listHeader) {
      return;
    }

    elements.listHeader.innerHTML = '';
    if (config.headerClassName) {
      elements.listHeader.className = `listHeader ${config.headerClassName}`;
    } else {
      elements.listHeader.className = 'listHeader';
    }

    if (Array.isArray(config.headerColumns) && config.headerColumns.length > 0) {
      config.headerColumns.forEach(column => {
        const cell = document.createElement('div');
        cell.textContent = column;
        elements.listHeader.append(cell);
      });
      return;
    }

    const guestHeader = document.createElement('div');
    guestHeader.textContent = 'Guest';

    const statusHeader = document.createElement('div');
    statusHeader.textContent = config.statusHeaderLabel ?? 'Status';

    elements.listHeader.append(guestHeader, statusHeader);
  }

  elements.searchInput.addEventListener('input', event => {
    state.search = event.target.value;
    render();
  });

  renderHeader();

  try {
    const seedGuests = await loadGuestSource();
    state.guests = loadStoredGuests(seedGuests, config.storageKey);
    render();
  } catch (error) {
    console.error('Failed to load guests', error);
    elements.emptyState.textContent = config.loadErrorMessage ?? 'Guest list could not be loaded.';
    elements.emptyState.style.display = 'block';
    updateStats([]);
  }
}

import {
  clearGuestSource,
  clearPizzaSource,
  loadGuestSource,
  loadPizzaSource,
  saveGuestSource,
  savePizzaSource
} from './guest-source.js';

const STORAGE_PREFIX = 'guest-tool-';

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register('./service-worker.js');
  } catch (error) {
    console.error('Service worker registration failed', error);
  }
}

function getStatusElement() {
  return document.getElementById('appStatus');
}

function showStatus(message) {
  const element = getStatusElement();
  if (element) {
    element.textContent = message;
  }
}

function getGuestSourceSummaryElement() {
  return document.getElementById('guestSourceSummary');
}

function showGuestSourceSummary(message) {
  const element = getGuestSourceSummaryElement();
  if (element) {
    element.textContent = message;
  }
}

function getPizzaSourceSummaryElement() {
  return document.getElementById('pizzaSourceSummary');
}

function showPizzaSourceSummary(message) {
  const element = getPizzaSourceSummaryElement();
  if (element) {
    element.textContent = message;
  }
}

function refreshGuestSourceSummary() {
  const source = loadGuestSource();
  if (!source) {
    showGuestSourceSummary('No guest list selected on this device yet.');
    return;
  }

  showGuestSourceSummary(`Loaded ${source.guestCount} guests from ${source.fileName}. Saved on this device${source.savedAt ? ` on ${new Date(source.savedAt).toLocaleString()}` : ''}.`);
}

function refreshPizzaSourceSummary() {
  const source = loadPizzaSource();
  if (!source) {
    showPizzaSourceSummary('No pizza list selected on this device yet.');
    return;
  }

  showPizzaSourceSummary(`Loaded ${source.pizzaCount} pizza entries from ${source.fileName}. Saved on this device${source.savedAt ? ` on ${new Date(source.savedAt).toLocaleString()}` : ''}.`);
}

function getStoredAppData() {
  const data = {};

  Object.keys(localStorage)
    .filter(key => key.startsWith(STORAGE_PREFIX))
    .forEach(key => {
      data[key] = localStorage.getItem(key);
    });

  return {
    exportedAt: new Date().toISOString(),
    data
  };
}

function downloadStateBackup() {
  const payload = JSON.stringify(getStoredAppData(), null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'guest-tool-backup.json';
  link.click();

  URL.revokeObjectURL(url);
  showStatus('App data exported to guest-tool-backup.json');
}

async function importStateBackup(file) {
  if (!file) {
    return;
  }

  const text = await file.text();
  const parsed = JSON.parse(text);
  const entries = Object.entries(parsed.data ?? {});

  entries.forEach(([key, value]) => {
    if (key.startsWith(STORAGE_PREFIX) && typeof value === 'string') {
      localStorage.setItem(key, value);
    }
  });

  refreshGuestSourceSummary();
  refreshPizzaSourceSummary();
  showStatus('App data imported. Reopen the attendance or pizza page to see the restored state.');
}

function initBackupControls() {
  const exportButton = document.getElementById('exportStateButton');
  const importInput = document.getElementById('importStateInput');
  const guestSourceInput = document.getElementById('guestSourceInput');
  const clearGuestSourceButton = document.getElementById('clearGuestSourceButton');
  const pizzaSourceInput = document.getElementById('pizzaSourceInput');
  const clearPizzaSourceButton = document.getElementById('clearPizzaSourceButton');

  if (exportButton) {
    exportButton.addEventListener('click', downloadStateBackup);
  }

  if (importInput) {
    importInput.addEventListener('change', async event => {
      try {
        const [file] = event.target.files ?? [];
        await importStateBackup(file);
      } catch (error) {
        console.error('Import failed', error);
        showStatus('Import failed. Please use a backup file created by this app.');
      } finally {
        event.target.value = '';
      }
    });
  }

  if (guestSourceInput) {
    guestSourceInput.addEventListener('change', async event => {
      try {
        const [file] = event.target.files ?? [];
        if (!file) {
          return;
        }

        const text = await file.text();
        const source = saveGuestSource(file.name, text);
        refreshGuestSourceSummary();
        showStatus(`Guest list loaded successfully with ${source.guestCount} guests.`);
      } catch (error) {
        console.error('Guest source import failed', error);
        showStatus('Guest list import failed. Please use a CSV in the Besucherliste format or a JSON guest list.');
      } finally {
        event.target.value = '';
      }
    });
  }

  if (clearGuestSourceButton) {
    clearGuestSourceButton.addEventListener('click', () => {
      clearGuestSource();
      refreshGuestSourceSummary();
      showStatus('Guest list removed from this device.');
    });
  }

  if (pizzaSourceInput) {
    pizzaSourceInput.addEventListener('change', async event => {
      try {
        const [file] = event.target.files ?? [];
        if (!file) {
          return;
        }

        const text = await file.text();
        const source = savePizzaSource(file.name, text);
        refreshPizzaSourceSummary();
        showStatus(`Pizza list loaded successfully with ${source.pizzaCount} entries.`);
      } catch (error) {
        console.error('Pizza source import failed', error);
        showStatus('Pizza list import failed. Use CSV or JSON with a guest name and, when available, pizza type and eligibility columns.');
      } finally {
        event.target.value = '';
      }
    });
  }

  if (clearPizzaSourceButton) {
    clearPizzaSourceButton.addEventListener('click', () => {
      clearPizzaSource();
      refreshPizzaSourceSummary();
      showStatus('Pizza list removed from this device.');
    });
  }
}

registerServiceWorker();
initBackupControls();
refreshGuestSourceSummary();
refreshPizzaSourceSummary();

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

  showStatus('App data imported. Reopen the attendance or pizza page to see the restored state.');
}

function initBackupControls() {
  const exportButton = document.getElementById('exportStateButton');
  const importInput = document.getElementById('importStateInput');

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
}

registerServiceWorker();
initBackupControls();

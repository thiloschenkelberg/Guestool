# Guest Tool

This is a single-device guest app for phone or tablet use at the festival.

It supports:

- attendance check-in
- guest checkout
- pizza tracking for Saturday
- pizza tracking for Sunday
- offline use after installation
- local backup export and restore

## How It Works

- The guest source is generated from `data/besucherliste.csv`.
- The generated in-app list lives in `data/guests.js`.
- Attendance and pizza state are saved in the browser storage on that one device.
- A service worker caches the app so it keeps working offline after installation.

## Files

- `index.html` - home page with install and backup actions
- `checkin.html` - attendance page
- `food.html` - pizza page
- `shared-page.js` - shared list rendering and local state logic
- `app-init.js` - service worker registration and backup import/export
- `service-worker.js` - offline caching
- `manifest.webmanifest` - install metadata for Android and iOS home-screen use
- `data/besucherliste.csv` - source guest list
- `data/guests.js` - generated guest list bundled into the app
- `tools/generate-guests.mjs` - rebuilds `data/guests.js` from the CSV

## Update The Guest List

When `data/besucherliste.csv` changes, regenerate the bundled guest file:

```bash
node tools/generate-guests.mjs
```

## Install For Mobile Use

Important:

- You do not need internet at the festival.
- You do need to install the app onto the device before the event.
- For the install step, serve the folder once from a secure hosted URL or another HTTPS-capable setup.

After the app is installed to the home screen and opened once, it can run offline on that device.

## Backup

On the home page:

- `Export App Data` saves attendance and pizza state as JSON
- `Import App Data` restores a previously exported backup

This is useful before updating the app or as a manual safety backup during the festival.

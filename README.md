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

- You choose a guest list file directly on the device from the app home page.
- You also choose a separate pizza list file directly on the device for the pizza page.
- Supported formats are CSV or JSON.
- The selected guest list is saved only in the browser storage on that one device.
- The selected pizza list is saved only in the browser storage on that same device.
- Attendance and pizza state are also saved in the browser storage on that same device.
- A service worker caches the app so it keeps working offline after installation.

## Files

- `index.html` - home page with install and backup actions
- `checkin.html` - attendance page
- `food.html` - pizza page
- `shared-page.js` - shared list rendering and local state logic
- `guest-source.js` - guest file parsing and local storage for the selected guest list
- `guest-source.js` also parses and stores the selected pizza list
- `app-init.js` - service worker registration and backup import/export
- `service-worker.js` - offline caching
- `manifest.webmanifest` - install metadata for Android and iOS home-screen use
- `data/` - optional local folder for guest files that you do not commit

## Install For Mobile Use

Important:

- You do not need internet at the festival.
- You do need to install the app onto the device before the event.
- For the install step, serve the folder once from a secure hosted URL or another HTTPS-capable setup.

After the app is installed to the home screen and opened once, it can run offline on that device.

Before going offline:

1. Open the app home page.
2. Tap `Select Guest List File`.
3. Choose your guest list file.
4. Choose your pizza list file.
5. Open the attendance and pizza pages once.

## Keep Guest Data Out Of Git

This project now ignores local guest files by default:

- `data/*.csv`
- `data/*.json`

That means you can keep `besucherliste.csv` locally in the `data/` folder for testing, but it will not be added to git unless you force it intentionally.

## Backup

On the home page:

- `Export App Data` saves attendance and pizza state as JSON
- `Import App Data` restores a previously exported backup, including the saved guest list and pizza list if they were part of the backup

This is useful before updating the app or as a manual safety backup during the festival.

# Eye Tracker - Food Preference Study

A web-based eye tracking tool that uses [WebGazer.js](https://webgazer.cs.brown.edu/) to record which food item a child looks at longest when shown side-by-side comparisons (e.g. packaged snack vs. fresh fruit). Results are saved to a local SQLite database and can be exported to Excel.

## Features

- Webcam-based eye tracking (no special hardware needed)
- Butterfly-themed calibration for kids
- 11 slide comparisons (packaged/processed food vs. natural food)
- Live webcam preview + gaze coordinates in sidebar
- Recalibration option mid-session
- One record per child session, saved to SQLite
- Export all data to a formatted Excel file (3 sheets: summary, per-slide breakdown, per-child stats)
- Delete records from a browser-based management page (no SQLite viewer needed)

## Requirements

- [Node.js](https://nodejs.org/) (v16 or later recommended)
- A webcam
- Google Chrome (recommended - WebGazer works best here)

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/NiranjanK28/Eye-Tracker.git
   cd Eye-Tracker
   ```

2. Install dependencies:
   ```bash
   npm install express cors sqlite3 xlsx
   npm install webgazer
   ```

   This installs:
   - `express`, `cors` - the local server
   - `sqlite3` - database storage
   - `xlsx` - Excel export
   - `webgazer` - the eye tracking engine (served locally, not from CDN)

3. Add your slide images to a `slides/` folder in the project root, named `slide-01.jpg` through `slide-11.jpg` (or update the filenames in `tracker.js` if yours differ).

## Running the app

```bash
node server.js
```

Then open **http://localhost:5000** in Chrome. (WebGazer requires a secure context - opening `index.html` directly as a file will not work, it must be served via `localhost`.)

## Usage

1. Enter the child's name and click **Start Session**
2. Allow camera access when prompted
3. Wait for the loading screen to finish (loads the tracking model)
4. Click each butterfly 8 times to calibrate
5. The slideshow begins - click **Next** after each slide
6. Use **Recalibrate** anytime if tracking feels off
7. When done, results are saved automatically

## Managing & exporting data

- **Export to Excel**: click the sidebar button, or visit `http://localhost:5000/export`
- **View / delete records**: visit `http://localhost:5000/manage`

## Project structure

```
Eye-Tracker/
├── server.js          # Express server + SQLite + Excel export
├── index.html         # Main study interface
├── manage.html         # Data management page
├── style.css           # Styling
├── tracker.js           # WebGazer logic, calibration, gaze recording
├── slides/               # Slide images (not included - add your own)
├── node_modules/          # Installed via npm install (ignored by git)
└── records.db              # SQLite database (created automatically, ignored by git)
```

## Notes

- `node_modules/` and `*.db` files are excluded from this repo via `.gitignore`. Run `npm install` after cloning to regenerate `node_modules`.
- The database is created automatically on first run - no manual setup needed.
- If calibration drift occurs across a long session, use the Recalibrate button.

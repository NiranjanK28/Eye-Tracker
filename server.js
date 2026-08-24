const express = require('express');
const cors    = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const app  = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
app.use('/mediapipe', express.static(path.join(__dirname, 'node_modules/webgazer/dist/mediapipe')));

const db = new sqlite3.Database('./records.db', (err) => {
    if (err) { console.error("DB error:", err.message); return; }
    console.log("Connected to records.db");

    // One row per child session.
    // Each slide gets 3 columns: _chosen (food name child looked at most),
    // _first (food name seen first), _duration (seconds on chosen item).
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        child_name              TEXT,
        session_date            TEXT,

        slide1_first  TEXT, slide1_chosen           TEXT, slide1_duration REAL,
        slide2_first  TEXT, slide2_chosen           TEXT, slide2_duration REAL,
        slide3_first  TEXT, slide3_chosen           TEXT, slide3_duration REAL,
        slide4_first  TEXT, slide4_chosen           TEXT, slide4_duration REAL,
        slide5_first  TEXT, slide5_chosen           TEXT, slide5_duration REAL,
        slide6_first  TEXT, slide6_chosen           TEXT, slide6_duration REAL,
        slide7_first  TEXT, slide7_chosen           TEXT, slide7_duration REAL,
        slide8_first  TEXT, slide8_chosen           TEXT, slide8_duration REAL,
        slide9_first  TEXT, slide9_chosen           TEXT, slide9_duration REAL,
        slide10_first TEXT, slide10_chosen          TEXT, slide10_duration REAL,
        slide11_first TEXT, slide11_chosen          TEXT, slide11_duration REAL
    )`);
});


app.post('/start_session', (req, res) => {
    const { child_name } = req.body;
    const session_date = new Date().toISOString().slice(0, 19).replace('T', ' ');
    db.run(
        `INSERT INTO sessions (child_name, session_date) VALUES (?, ?)`,
        [child_name, session_date],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            console.log(`Session started for "${child_name}" (id=${this.lastID})`);
            res.json({ session_id: this.lastID });
        }
    );
});


app.post('/save_slide', (req, res) => {
    const { session_id, slide_number, chosen, first, duration } = req.body;
    const col = `slide${slide_number}`;
    const sql = `UPDATE sessions SET
        ${col}_chosen   = ?,
        ${col}_first    = ?,
        ${col}_duration = ?
        WHERE id = ?`;
    db.run(sql, [chosen, first, duration, session_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        console.log(`  Slide ${slide_number} saved for session ${session_id}: chosen="${chosen}"`);
        res.json({ ok: true });
    });
});

app.listen(PORT, () => {
    console.log(`\n🟢  http://localhost:${PORT}  — open this in Chrome\n`);
});

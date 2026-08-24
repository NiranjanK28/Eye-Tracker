// ─────────────────────────────────────────────────────────────────────────────
//  Eye Tracking Slideshow — tracker.js
// ─────────────────────────────────────────────────────────────────────────────

// ── Slide definitions ─────────────────────────────────────────────────────────
// Each slide: { src, left: food on left half, right: food on right half }
// Images must be in the same folder as server.js (they're served as static files)
const SLIDES = [
    { src: 'slides/slide-01.jpg', left: 'Strawberry chocolate', right: 'Strawberry'              },
    { src: 'slides/slide-02.jpg', left: 'Cavins milkshake',     right: 'Badam milk'              },
    { src: 'slides/slide-03.jpg', left: 'Naturo',               right: 'Mango'                   },
    { src: 'slides/slide-04.jpg', left: 'Fruit juice',          right: 'Fruits'                  },
    { src: 'slides/slide-05.jpg', left: 'Packaged cake',        right: 'Homemade cake'           },
    { src: 'slides/slide-06.jpg', left: 'Packaged coconut water', right: 'Tender coconut'        },
    { src: 'slides/slide-07.jpg', left: 'Orange',               right: 'Packaged fruit juice'    },
    { src: 'slides/slide-08.jpg', left: 'Yogurt',               right: 'Curd'                    },
    { src: 'slides/slide-09.jpg', left: 'Banana',               right: 'Banana chips'            },
    { src: 'slides/slide-10.jpg', left: 'Packaged Peanuts',     right: 'Freshly Prepared Peanuts'},
    { src: 'slides/slide-11.jpg', left: 'Lemon juice',          right: 'Packed lemon juice'      },
];

const CLICKS_NEEDED = 8;
const SIDEBAR_WIDTH = 220;

let childName  = "";
let sessionId  = null;   // DB row id for this session
let idx        = 0;
let lastTime   = null;
let gazeData   = makeGazeData();
let phase      = 'waiting';


function makeGazeData() {
    return { firstSide: null, times: { left: 0, right: 0 } };
}

const $ = id => document.getElementById(id);

// ── Step 1: Name screen ───────────────────────────────────────────────────────

window.onload = () => {
    const input     = $('name-input');
    const submitBtn = $('name-submit-btn');

    input.addEventListener('keydown', e => { if (e.key === 'Enter') submitBtn.click(); });

    submitBtn.onclick = async () => {
        const val = input.value.trim();
        if (!val) {
            input.style.borderColor = '#e53935';
            input.style.boxShadow   = '0 0 0 3px rgba(229,57,53,0.25)';
            input.placeholder = 'Please enter a name first!';
            input.focus();
            setTimeout(() => {
                input.style.borderColor = '';
                input.style.boxShadow   = '';
                input.placeholder = "Child's name…";
            }, 2000);
            return;
        }
        childName = val;

        // Create the session row in DB immediately so we have an id
        try {
            const res  = await fetch('http://localhost:5000/start_session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ child_name: childName })
            });
            const data = await res.json();
            sessionId  = data.session_id;
            console.log(`[tracker] Session created (id=${sessionId})`);
        } catch(e) {
            console.error("[tracker] Could not start session:", e);
        }

        $('name-screen').style.display    = 'none';
        $('loading-screen').style.display = 'flex';
        initWebGazer();
    };

    input.focus();
};

// ── Step 2: Init WebGazer ─────────────────────────────────────────────────────

async function initWebGazer() {
    setProgress("Starting camera & AI model…", 20);
    if (typeof webgazer === 'undefined') {
        setProgress("❌ WebGazer failed to load. Refresh.", 0); return;
    }

    try {
        await webgazer
            .showVideo(true).showFaceOverlay(true)
            .showFaceFeedbackBox(true).showPredictionPoints(true)
            .begin();
        setProgress("Camera ready! Detecting face…", 60);
    } catch (err) {
        setProgress("❌ Camera error: " + err.message, 0);
        console.error("[tracker]", err); return;
    }

    // ── THE ONE GAZE LISTENER ─────────────────────────────────────────────────
    webgazer.setGazeListener((gaze, time) => {
        if (gaze) updateCoords(gaze);

        if (phase === 'waiting') {
            if (gaze) {
                phase = 'calibrating';
                setProgress("Face detected! Let's calibrate…", 90);
                setTimeout(() => {
                    $('loading-screen').style.display     = 'none';
                    $('app-layout').style.display         = 'flex';
                    mountWebcamToSidebar();
                    $('calibration-screen').style.display = 'block';
                    setupCalibration();
                }, 600);
            }
            return;
        }

        if (phase !== 'testing') return;
        if (!gaze) return;

        const dt = lastTime !== null ? (time - lastTime) : 0;
        lastTime = time;
        if (dt <= 0 || dt > 500) return;

        // Map gaze to left or right half of content area
        const contentWidth = window.innerWidth - SIDEBAR_WIDTH;
        const xInContent   = gaze.x - SIDEBAR_WIDTH;
        if (xInContent < 0 || xInContent > contentWidth) return;

        const side = xInContent / contentWidth < 0.5 ? 'left' : 'right';

        if (!gazeData.firstSide) gazeData.firstSide = side;
        gazeData.times[side] += dt;

        // Highlight active half
        document.querySelectorAll('.half').forEach(h => h.classList.remove('active'));
        $(`half-${side}`)?.classList.add('active');
    });

    // 15s fallback
    setTimeout(() => {
        if (phase === 'waiting') {
            phase = 'calibrating';
            $('loading-screen').style.display     = 'none';
            $('app-layout').style.display         = 'flex';
            mountWebcamToSidebar();
            $('calibration-screen').style.display = 'block';
            setupCalibration();
        }
    }, 15000);
}

// ── Sidebar webcam mount ──────────────────────────────────────────────────────

function mountWebcamToSidebar() {
    const box    = $('webcam-box');
    const toMove = ['webgazerVideoFeed','webgazerVideoCanvas','webgazerFaceFeedbackBox'];

    toMove.forEach(id => {
        const el = $(id);
        if (!el) return;
        el.style.cssText = `
            position:absolute!important; top:0!important; left:0!important;
            width:100%!important; height:100%!important;
            object-fit:cover!important; border-radius:10px!important;
            z-index:auto!important; transform:scaleX(-1)!important;
        `;
        box.appendChild(el);
    });

    const ph = $('webcam-placeholder');
    if (ph) ph.style.display = 'none';

    const dot = $('webgazerGazeDot');
    if (dot) { dot.style.zIndex = '999999'; dot.style.position = 'fixed'; }

    let attempts = 0;
    const poll = setInterval(() => {
        attempts++;
        toMove.forEach(id => {
            const el = $(id);
            if (el && el.parentElement !== box) {
                el.style.cssText = `
                    position:absolute!important; top:0!important; left:0!important;
                    width:100%!important; height:100%!important;
                    object-fit:cover!important; border-radius:10px!important;
                    z-index:auto!important; transform:scaleX(-1)!important;
                `;
                box.appendChild(el);
            }
        });
        const d = $('webgazerGazeDot');
        if (d) { d.style.zIndex = '999999'; d.style.position = 'fixed'; }
        if (attempts > 20) clearInterval(poll);
    }, 200);
}

// ── Coord display ─────────────────────────────────────────────────────────────

function updateCoords(gaze) {
    const cw         = window.innerWidth - SIDEBAR_WIDTH;
    const xInContent = Math.max(0, gaze.x - SIDEBAR_WIDTH);
    $('coord-x').textContent    = `${Math.round(gaze.x)} px`;
    $('coord-y').textContent    = `${Math.round(gaze.y)} px`;
    $('coord-zone').textContent = xInContent / cw < 0.5 ? 'left' : 'right';
}

function setProgress(msg, pct) {
    $('loading-text').textContent = msg;
    $('loading-bar').style.width  = pct + '%';
}

// ── Step 3: Calibration (3 butterflies) ──────────────────────────────────────

function setupCalibration() {
    const dots   = document.querySelectorAll('.cal-point');
    const counts = {};
    let done     = 0;

    $('calibration-progress').textContent = '0 / 9 caught';

    dots.forEach(dot => {
        counts[dot.id] = 0;

        // Clone to remove stale listeners (for recalibration)
        const fresh = dot.cloneNode(true);
        fresh.classList.remove('done', 'clicked');
        fresh.style.fontSize = '2.6rem';
        dot.parentNode.replaceChild(fresh, dot);

        fresh.addEventListener('click', () => {
            if (fresh.classList.contains('done')) return;

            counts[fresh.id]++;

            // Play shrink animation on each click
            fresh.classList.add('clicked');
            setTimeout(() => fresh.classList.remove('clicked'), 260);

            // Visual progress: emoji gets slightly smaller
            const scale = 1 - (counts[fresh.id] / CLICKS_NEEDED) * 0.35;
            fresh.style.fontSize = `${2.6 * scale}rem`;

            if (counts[fresh.id] >= CLICKS_NEEDED) {
                fresh.classList.add('done');
                done++;
                $('calibration-progress').textContent = `${done} / 9 caught`;
                if (done === 9) {
                    setTimeout(() => {
                        // Celebration before starting
                        $('calibration-progress').textContent = '🎉 All caught! Starting…';
                        setTimeout(startTest, 800);
                    }, 300);
                }
            }
        });
    });
}

// ── Step 4: Test ──────────────────────────────────────────────────────────────

function startTest() {
    $('calibration-screen').style.display = 'none';
    $('slide-viewer').style.display = 'block';
    $('grid-overlay').style.display = 'grid';
    $('next-btn').style.display     = 'block';
    $('recal-btn').style.display    = 'block';

    webgazer.removeMouseEventListeners();
    // Hide cursor in content area so its position can't bias WebGazer
    $('content-area').classList.add('testing');

    webgazer.showFaceOverlay(false).showFaceFeedbackBox(false);

    loadSlide(idx);
    phase    = 'testing';
    lastTime = null;
    gazeData = makeGazeData();

    // Arrow-key (→) advances to next slide
    const onKey = (e) => {
        if (phase !== 'testing') return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            $('next-btn').click();
        }
    };
    document.addEventListener('keydown', onKey);

    $('recal-btn').onclick = () => {
        phase    = 'calibrating';
        gazeData = makeGazeData();
        lastTime = null;

        webgazer.addMouseEventListeners();

        $('content-area').classList.remove('testing');
        document.removeEventListener('keydown', onKey);
        $('slide-viewer').style.display = 'none';
        $('grid-overlay').style.display = 'none';
        $('next-btn').style.display     = 'none';
        $('recal-btn').style.display    = 'none';
        webgazer.showFaceOverlay(true).showFaceFeedbackBox(true);
        $('calibration-screen').style.display = 'block';
        setupCalibration();
    };

    $('next-btn').onclick = () => {
        saveSlideData(idx);    // save current slide
        idx++;
        if (idx < SLIDES.length) {
            loadSlide(idx);
            gazeData = makeGazeData();
            lastTime = null;
        } else {
            phase = 'done';
            webgazer.end();
            $('content-area').classList.remove('testing');
            $('next-btn').style.display  = 'none';
            $('recal-btn').style.display = 'none';
            $('slide-viewer').style.display = 'none';
            $('grid-overlay').style.display = 'none';
            showCompletionScreen();
        }
    };
}

function loadSlide(i) {
    const slide = SLIDES[i];
    $('slide-viewer').src = slide.src;
    $('slide-counter').textContent = `Slide ${i + 1} / ${SLIDES.length}`;
    console.log(`[tracker] Slide ${i+1}: ${slide.left} vs ${slide.right}`);
}

function showCompletionScreen() {
    const content = $('content-area');
    content.innerHTML = `
        <div style="
            position:absolute;inset:0;display:flex;flex-direction:column;
            align-items:center;justify-content:center;
            background:#0d1a0d;color:#fff;font-family:'Nunito',sans-serif;
            text-align:center;padding:40px;
        ">
            <div style="font-size:4rem;margin-bottom:20px;">🎉</div>
            <h1 style="font-size:2rem;font-weight:800;color:#4CAF50;margin-bottom:12px;">All done!</h1>
            <p style="font-size:1.1rem;color:rgba(255,255,255,0.6);">
                Great job, ${childName}!<br>Your results have been saved.
            </p>
        </div>
    `;
}

// ── Save slide data ───────────────────────────────────────────────────────────

function saveSlideData(slideIndex) {
    const slide  = SLIDES[slideIndex];
    const times  = gazeData.times;
    const total  = times.left + times.right;

    console.log(`[tracker] Slide ${slideIndex+1} gaze — left:${times.left}ms right:${times.right}ms`);

    if (total <= 0 || !sessionId) {
        console.warn(`[tracker] No gaze data or no session id — skipping slide ${slideIndex+1}`);
        return;
    }

    // Determine which food name the child looked at most
    const chosenSide  = times.left >= times.right ? 'left' : 'right';
    const chosenFood  = slide[chosenSide];
    const firstFood   = gazeData.firstSide ? slide[gazeData.firstSide] : 'none';
    const duration    = parseFloat((times[chosenSide] / 1000).toFixed(2));

    const payload = {
        session_id:   sessionId,
        slide_number: slideIndex + 1,  // 1-indexed
        chosen:       chosenFood,
        first:        firstFood,
        duration:     duration
    };

    console.log(`[tracker] Saving slide ${slideIndex+1}:`, payload);

    fetch('http://localhost:5000/save_slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(() => console.log(`[tracker] ✅ Slide ${slideIndex+1} saved`))
    .catch(e  => console.error("[tracker] ❌ Save failed:", e));
}
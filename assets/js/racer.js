/* =====================================================
   ZUURA Racer — racer.js  (Top-Down Circuit Time-Trial)
   Multi-track, drivable car, racing line, ghost, minimap,
   countdown. Static track pre-rendered to an offscreen
   layer for performance. Needs racer-tracks.js loaded first.
   ===================================================== */
(function () {
  "use strict";
  var canvas = document.getElementById("racer");
  if (!canvas || !window.RACER_TRACKS || !window.RTRACK) return;
  var ctx = canvas.getContext("2d");
  var DEBUG = /[?&]debug=1\b/.test(location.search);
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- constants ---------- */
  var STEP = 1 / 60, TRACK_VER = 1;
  var VMAX = 1500, ACC = 1500, BRK = 2600, ROLL = 520, OFF_DRAG = 1900, TURN = 2.8, KMH_K = 0.14;
  var BASE_ROAD = 300, CAR_L = 150, CAR_W = 90, VIEW_WORLD = 1900;
  var GHOST_DT = 0.1, MIN_LAP = 5;
  var GRASS = "#0b1410", ASPHALT = "#26262e", RUMBLE_C = "#D4A017", LANE = "rgba(232,224,208,0.5)", RACELINE = "#39d353";

  /* ---------- car sprite ---------- */
  var carImg = null, carReady = false;
  (function () { var i = new Image(); i.onload = function () { carImg = i; carReady = true; render(); }; i.onerror = function () {}; i.src = "assets/images/racer/car.svg"; })();

  /* ---------- track build / precompute ---------- */
  var TRACKS = window.RACER_TRACKS, RT = window.RTRACK;
  var trackIndex = 0, track = null;
  var C = [], NPTS = 0, segLen = [], cumS = [], L = 0, normals = [], curv = [], ROAD_W = BASE_ROAD;
  var raceLine = [], bbox = null;
  var trackLayer = null, raceLayer = null, miniLayer = null, mini = null;

  function buildTrack(idx) {
    track = TRACKS[idx];
    var built = RT.buildCenterline(track);
    C = built.points; NPTS = C.length; L = built.length;
    ROAD_W = BASE_ROAD * (track.widthMul || 1);
    segLen = []; cumS = []; var acc = 0, i;
    for (i = 0; i < NPTS; i++) { var a = C[i], b = C[(i + 1) % NPTS]; cumS[i] = acc; segLen[i] = Math.hypot(b.x - a.x, b.y - a.y); acc += segLen[i]; }
    L = acc;
    normals = []; for (i = 0; i < NPTS; i++) normals.push(RT.normalAt(C, i));
    curv = RT.curvatures(C);
    raceLine = RT.deriveRacingLine(C, ROAD_W / 2 - CAR_W * 0.55, 170);
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (i = 0; i < NPTS; i++) { if (C[i].x < minX) minX = C[i].x; if (C[i].x > maxX) maxX = C[i].x; if (C[i].y < minY) minY = C[i].y; if (C[i].y > maxY) maxY = C[i].y; }
    var pad = ROAD_W; bbox = { x0: minX - pad, y0: minY - pad, w: (maxX - minX) + 2 * pad, h: (maxY - minY) + 2 * pad };
    buildLayers();
  }

  function pathOnLayer(g, pts, lpp, ox, oy) { g.beginPath(); g.moveTo((pts[0].x - ox) * lpp, (pts[0].y - oy) * lpp); for (var i = 1; i < pts.length; i++) g.lineTo((pts[i].x - ox) * lpp, (pts[i].y - oy) * lpp); g.closePath(); }
  function buildLayers() {
    var lpp = Math.min(1, 1500 / Math.max(bbox.w, bbox.h));
    var lw = Math.max(2, Math.round(bbox.w * lpp)), lh = Math.max(2, Math.round(bbox.h * lpp));
    trackLayer = document.createElement("canvas"); trackLayer.width = lw; trackLayer.height = lh;
    var g = trackLayer.getContext("2d"); g.lineJoin = "round"; g.lineCap = "round";
    pathOnLayer(g, C, lpp, bbox.x0, bbox.y0); g.strokeStyle = RUMBLE_C; g.lineWidth = (ROAD_W + 52) * lpp; g.stroke();
    pathOnLayer(g, C, lpp, bbox.x0, bbox.y0); g.strokeStyle = ASPHALT; g.lineWidth = ROAD_W * lpp; g.stroke();
    // curbs (red/white) on corners
    for (var i = 0; i < NPTS; i++) {
      if (curv[i] > 0.045) {
        var n = normals[i], cx = (C[i].x - bbox.x0) * lpp, cy = (C[i].y - bbox.y0) * lpp;
        var inner = curbInner(i), edge = (ROAD_W / 2 - 10) * lpp;
        g.strokeStyle = (i % 2 === 0) ? "#d8443a" : "#e8e0d0"; g.lineWidth = 9 * lpp;
        g.beginPath(); g.moveTo(cx + n.x * inner * edge, cy + n.y * inner * edge);
        var j = (i + 1) % NPTS, n2 = normals[j];
        g.lineTo((C[j].x - bbox.x0) * lpp + n2.x * inner * (ROAD_W / 2 - 10) * lpp, (C[j].y - bbox.y0) * lpp + n2.y * inner * (ROAD_W / 2 - 10) * lpp);
        g.stroke();
      }
    }
    // dashed centre line
    g.save(); g.setLineDash([20 * lpp, 22 * lpp]); pathOnLayer(g, C, lpp, bbox.x0, bbox.y0); g.strokeStyle = LANE; g.lineWidth = Math.max(1, 4 * lpp); g.stroke(); g.restore();
    // start/finish (checker) + halfway marker
    layerBar(g, 0, lpp, "#ffffff", true); layerBar(g, (NPTS / 2) | 0, lpp, "rgba(212,160,23,0.9)", false);
    trackLayer._lpp = lpp;

    // racing-line layer
    raceLayer = document.createElement("canvas"); raceLayer.width = lw; raceLayer.height = lh;
    var rg = raceLayer.getContext("2d"); rg.lineJoin = "round"; rg.lineCap = "round";
    rg.setLineDash([14 * lpp, 12 * lpp]); pathOnLayer(rg, raceLine, lpp, bbox.x0, bbox.y0);
    rg.strokeStyle = RACELINE; rg.lineWidth = Math.max(2, 9 * lpp); rg.shadowBlur = 8; rg.shadowColor = RACELINE; rg.stroke();

    buildMinimap();
  }
  function curbInner(i) { // sign so curb sits on the inside of the corner
    var a = C[(i - 1 + NPTS) % NPTS], b = C[i], c = C[(i + 1) % NPTS];
    var cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    return cross > 0 ? 1 : -1;
  }
  function layerBar(g, i, lpp, color, checker) {
    var p = C[i], n = normals[i], hw = ROAD_W / 2;
    var x1 = (p.x - n.x * hw - bbox.x0) * lpp, y1 = (p.y - n.y * hw - bbox.y0) * lpp;
    var x2 = (p.x + n.x * hw - bbox.x0) * lpp, y2 = (p.y + n.y * hw - bbox.y0) * lpp;
    if (checker) {
      var segs = 8; for (var k = 0; k < segs; k++) { g.strokeStyle = k % 2 ? "#0b0a08" : "#ffffff"; g.lineWidth = 14 * lpp; g.beginPath(); g.moveTo(x1 + (x2 - x1) * k / segs, y1 + (y2 - y1) * k / segs); g.lineTo(x1 + (x2 - x1) * (k + 1) / segs, y1 + (y2 - y1) * (k + 1) / segs); g.stroke(); }
    } else { g.strokeStyle = color; g.lineWidth = 8 * lpp; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  }
  function buildMinimap() {
    var MM = 132, pad = 10, mscale = (MM - 2 * pad) / Math.max(bbox.w, bbox.h);
    var cx = bbox.x0 + bbox.w / 2, cy = bbox.y0 + bbox.h / 2;
    mini = { size: MM, scale: mscale, cx: cx, cy: cy, mx: function (x) { return MM / 2 + (x - cx) * mscale; }, my: function (y) { return MM / 2 + (y - cy) * mscale; } };
    miniLayer = document.createElement("canvas"); miniLayer.width = MM; miniLayer.height = MM;
    var g = miniLayer.getContext("2d");
    g.fillStyle = "rgba(8,7,6,0.6)"; g.fillRect(0, 0, MM, MM);
    g.strokeStyle = "rgba(212,160,23,0.4)"; g.lineWidth = 1; g.strokeRect(0.5, 0.5, MM - 1, MM - 1);
    g.lineJoin = "round"; g.lineCap = "round";
    g.beginPath(); g.moveTo(mini.mx(C[0].x), mini.my(C[0].y)); for (var i = 1; i < NPTS; i++) g.lineTo(mini.mx(C[i].x), mini.my(C[i].y)); g.closePath();
    g.strokeStyle = "rgba(212,160,23,0.7)"; g.lineWidth = Math.max(2, ROAD_W * mscale * 0.7); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(mini.mx(C[0].x), mini.my(C[0].y), 3, 0, 7); g.fill();
  }

  /* ---------- state ---------- */
  var view = { w: 0, h: 0, scale: 1, ppwBase: 1 };
  var isCoarse = window.matchMedia && matchMedia("(pointer:coarse)").matches;
  var cam = { x: 0, y: 0, zoom: 1 };
  var car = { x: 0, y: 0, heading: 0, speed: 0 };
  var state = {
    race: "ready", wasCountdown: false, time: 0, lapStartTime: 0, countT: 0,
    currentLap: 1, lastLap: null, bestLap: null, s: 0, segIdx: 0, passedHalf: false, racingOn: false
  };
  var marks = [], curGhost = [], bestGhost = null, lastGhostT = 0;
  var input = { left: false, right: false, gas: false, brake: false, steer: 0 };

  function bestKey() { return "zuura_td_best_" + track.id; }
  function ghostKey() { return "zuura_td_ghost_" + track.id; }
  function loadBest() { try { var v = parseFloat(localStorage.getItem(bestKey())); return (isFinite(v) && v > 0 && v < 3600) ? v : null; } catch (e) { return null; } }
  function saveBest(v) { try { localStorage.setItem(bestKey(), String(v)); } catch (e) {} }
  function loadGhost() {
    try {
      var raw = localStorage.getItem(ghostKey()); if (!raw) return null;
      var o = JSON.parse(raw); if (!o || o.v !== TRACK_VER || !o.s || !o.s.length) return null; return o;
    } catch (e) { return null; }
  }
  function saveGhost(samples, lap) {
    try { localStorage.setItem(ghostKey(), JSON.stringify({ v: TRACK_VER, dt: GHOST_DT, t: Math.round(lap * 100) / 100, s: samples })); } catch (e) {}
  }
  function loadPrefs() {
    try { state.racingOn = localStorage.getItem("zuura_td_raceline") === "1"; } catch (e) {}
    try { var ti = parseInt(localStorage.getItem("zuura_td_track"), 10); if (isFinite(ti) && ti >= 0 && ti < TRACKS.length) trackIndex = ti; } catch (e) {}
  }
  function savePref(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function resetCar() {
    car.x = C[0].x; car.y = C[0].y; car.speed = 0;
    var t = { x: C[1].x - C[NPTS - 1].x, y: C[1].y - C[NPTS - 1].y }; car.heading = Math.atan2(t.y, t.x);
    cam.x = car.x; cam.y = car.y; cam.zoom = 1; marks.length = 0;
    state.s = 0; state.segIdx = 0; state.passedHalf = false;
    state.time = 0; state.lapStartTime = 0; state.currentLap = 1; state.lastLap = null;
    curGhost = []; lastGhostT = 0; resetInputs();
  }
  function loadTrack(idx) {
    trackIndex = (idx + TRACKS.length) % TRACKS.length; savePref("zuura_td_track", String(trackIndex));
    buildTrack(trackIndex); state.bestLap = loadBest();
    var g = loadGhost(); bestGhost = g ? g.s : null;
    resetCar(); resize();
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function fmt(t) { if (t == null || !isFinite(t)) return "--:--"; var m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2); }

  /* ---------- progress / lap (scalar arc length) ---------- */
  function segProject(px, py, i) {
    var a = C[i], b = C[(i + 1) % NPTS], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    var t = l2 ? ((px - a.x) * dx + (py - a.y) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    var ex = px - (a.x + t * dx), ey = py - (a.y + t * dy);
    return { d2: ex * ex + ey * ey, t: t };
  }
  function projectProgress() {
    var W = 14, best = { d2: Infinity, i: state.segIdx, t: 0 }, k, i;
    for (k = -W; k <= W; k++) { i = ((state.segIdx + k) % NPTS + NPTS) % NPTS; var r = segProject(car.x, car.y, i); if (r.d2 < best.d2) { best.d2 = r.d2; best.i = i; best.t = r.t; } }
    if (best.d2 > (ROAD_W * 2.5) * (ROAD_W * 2.5)) { for (i = 0; i < NPTS; i++) { var g = segProject(car.x, car.y, i); if (g.d2 < best.d2) { best.d2 = g.d2; best.i = i; best.t = g.t; } } }
    best.dist = Math.sqrt(best.d2); best.sProj = cumS[best.i] + best.t * segLen[best.i];
    return best;
  }

  /* ---------- update ---------- */
  function update(dt) {
    if (state.race === "countdown") { state.countT -= dt; if (state.countT <= -0.6) { state.race = "playing"; state.time = 0; state.lapStartTime = 0; curGhost = []; lastGhostT = 0; } return; }
    if (state.race !== "playing") return;
    state.time += dt;

    var pr = projectProgress(), onTrack = pr.dist <= ROAD_W / 2, vmax = onTrack ? VMAX : VMAX * 0.45;
    if (input.gas) car.speed += ACC * dt; else if (input.brake) car.speed -= BRK * dt; else car.speed -= ROLL * dt * (car.speed > 0 ? 1 : 0);
    if (!onTrack && car.speed > vmax) car.speed -= OFF_DRAG * dt;
    car.speed = clamp(car.speed, 0, vmax);
    var tf = Math.min(1, 0.22 + car.speed / (VMAX * 0.4));
    car.heading += input.steer * TURN * tf * dt;
    car.x += Math.cos(car.heading) * car.speed * dt; car.y += Math.sin(car.heading) * car.speed * dt;

    // tire marks
    if ((Math.abs(input.steer) > 0 && car.speed > VMAX * 0.45) || (input.brake && car.speed > VMAX * 0.5)) {
      var bx = car.x - Math.cos(car.heading) * CAR_L * 0.32, by = car.y - Math.sin(car.heading) * CAR_L * 0.32;
      var nx = -Math.sin(car.heading) * CAR_W * 0.34, ny = Math.cos(car.heading) * CAR_W * 0.34;
      marks.push({ x: bx + nx, y: by + ny, a: 1 }); marks.push({ x: bx - nx, y: by - ny, a: 1 });
      if (marks.length > 280) marks.splice(0, marks.length - 280);
    }
    for (var m = marks.length - 1; m >= 0; m--) { marks[m].a -= dt * 0.32; if (marks[m].a <= 0) marks.splice(m, 1); }

    // ghost record (sim-time keyed)
    if (state.time - lastGhostT >= GHOST_DT) { lastGhostT += GHOST_DT; curGhost.push([Math.round(car.x), Math.round(car.y), Math.round(car.heading * 100) / 100]); }

    // camera follow + subtle speed zoom
    var lead = 220, tx = car.x + Math.cos(car.heading) * lead, ty = car.y + Math.sin(car.heading) * lead, k2 = Math.min(1, dt * 3.5);
    cam.x += (tx - cam.x) * k2; cam.y += (ty - cam.y) * k2;
    var targetZoom = REDUCED ? 1 : (1 - (car.speed / VMAX) * 0.16);
    cam.zoom += (targetZoom - cam.zoom) * Math.min(1, dt * 2);

    // progress + lap detection
    var raw = pr.sProj - state.s; if (raw < -L / 2) raw += L; if (raw > L / 2) raw -= L;
    var maxDelta = VMAX * dt * 5;
    if (pr.dist <= ROAD_W && Math.abs(raw) <= maxDelta) {
      if (raw > 0) {
        if (state.s < L / 2 && state.s + raw >= L / 2) state.passedHalf = true;
        if (state.s + raw >= L && state.passedHalf && (state.time - state.lapStartTime) > MIN_LAP) lapComplete();
      }
      state.s = (state.s + raw) % L; if (state.s < 0) state.s += L;
      state.segIdx = pr.i;
    }
  }
  function lapComplete() {
    var lap = state.time - state.lapStartTime; state.lastLap = lap;
    if (state.bestLap == null || lap < state.bestLap) { state.bestLap = lap; saveBest(lap); bestGhost = curGhost.slice(); saveGhost(bestGhost, lap); flash("NEW BEST LAP"); }
    state.currentLap++; state.lapStartTime = state.time; state.passedHalf = false; curGhost = []; lastGhostT = state.time;
  }

  /* ---------- render ---------- */
  function S() { return view.ppwBase * cam.zoom; }
  function sx(x) { return (x - cam.x) * S() + view.w / 2; }
  function sy(y) { return (y - cam.y) * S() + view.h / 2; }
  function blitLayer(layer) { var s = S(); ctx.drawImage(layer, (bbox.x0 - cam.x) * s + view.w / 2, (bbox.y0 - cam.y) * s + view.h / 2, bbox.w * s, bbox.h * s); }
  function ghostSample(tg) {
    if (!bestGhost || !bestGhost.length) return null;
    var f = tg / GHOST_DT, i = Math.floor(f); if (i >= bestGhost.length - 1) return null;
    var a = bestGhost[i], b = bestGhost[i + 1], u = f - i;
    return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, h: a[2] + (b[2] - a[2]) * u };
  }
  function drawCarAt(x, y, h, alpha) {
    if (!carReady) return; var w = CAR_W * S(), hh = CAR_L * S();
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(sx(x), sy(y)); ctx.rotate(h + Math.PI / 2); ctx.drawImage(carImg, -w / 2, -hh / 2, w, hh); ctx.restore(); ctx.globalAlpha = 1;
  }
  function render() {
    var W = view.w, H = view.h; if (!W || !H || !trackLayer) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = GRASS; ctx.fillRect(0, 0, W, H);
    blitLayer(trackLayer);
    if (state.racingOn && raceLayer) blitLayer(raceLayer);
    for (var i = 0; i < marks.length; i++) { ctx.fillStyle = "rgba(10,9,8," + (0.5 * marks[i].a) + ")"; var r = Math.max(1.2, CAR_W * 0.07 * S()); ctx.beginPath(); ctx.arc(sx(marks[i].x), sy(marks[i].y), r, 0, 7); ctx.fill(); }
    if (state.race === "playing") { var gs = ghostSample(state.time - state.lapStartTime); if (gs) drawCarAt(gs.x, gs.y, gs.h, 0.4); }
    drawCarAt(car.x, car.y, car.heading, 1);
    drawMinimap();
  }
  function drawMinimap() {
    if (!miniLayer || !mini) return;
    var sc = view.scale, MM = miniLayer.width, ox = 16 * sc, oy = 92 * sc, size = MM * sc;
    ctx.drawImage(miniLayer, ox, oy, size, size);
    ctx.fillStyle = "#D4A017"; ctx.beginPath(); ctx.arc(ox + mini.mx(car.x) * sc, oy + mini.my(car.y) * sc, 3.5, 0, 7); ctx.fill();
    if (state.race === "playing") { var gs = ghostSample(state.time - state.lapStartTime); if (gs) { ctx.fillStyle = "rgba(232,224,208,0.8)"; ctx.beginPath(); ctx.arc(ox + mini.mx(gs.x) * sc, oy + mini.my(gs.y) * sc, 2.6, 0, 7); ctx.fill(); } }
  }

  /* ---------- HUD / overlay / selector ---------- */
  var dom = {}, cache = {};
  function setText(el, key, val) { if (el && cache[key] !== val) { el.textContent = val; cache[key] = val; } }
  function updateHud() {
    setText(dom.lap, "lap", String(state.currentLap));
    setText(dom.cur, "cur", state.race === "countdown" ? "0:00.00" : fmt(state.time - state.lapStartTime));
    setText(dom.last, "last", fmt(state.lastLap));
    setText(dom.best, "best", fmt(state.bestLap));
    setText(dom.speed, "spd", String(Math.round(car.speed * KMH_K)));
    if (dom.count) {
      if (state.race === "countdown") { dom.count.style.display = "flex"; var c = Math.ceil(state.countT); dom.count.textContent = state.countT <= 0 ? "GO" : String(c); }
      else dom.count.style.display = "none";
    }
  }
  var flashTimer = 0;
  function flash(text) { if (!dom.flash) return; dom.flash.textContent = text; dom.flash.classList.add("show"); clearTimeout(flashTimer); flashTimer = setTimeout(function () { dom.flash.classList.remove("show"); }, 1700); }
  function refreshSelector() {
    if (dom.trkName) dom.trkName.textContent = track.name;
    if (dom.trkCountry) dom.trkCountry.textContent = track.country;
    setText(dom.ovBest, "ovbest", fmt(state.bestLap));
    if (dom.lineToggle) dom.lineToggle.classList.toggle("on", state.racingOn);
    if (dom.lineToggle) dom.lineToggle.textContent = "Racing line: " + (state.racingOn ? "On" : "Off");
    if (dom.lineBtn) dom.lineBtn.classList.toggle("active", state.racingOn);
  }
  function showOverlay(mode) {
    if (!dom.overlay) return;
    if (mode === "pause") { dom.title.innerHTML = "PAUSED"; dom.sub.textContent = "Take a breath. Your lap timer is frozen."; dom.start.textContent = "Resume"; }
    else { dom.title.innerHTML = 'ZFR <span>RACER</span>'; dom.sub.textContent = "Pick a circuit, drive clean laps and beat your best. Toggle the green racing line to learn the fast way round."; dom.start.textContent = "Start"; }
    refreshSelector(); dom.overlay.classList.remove("is-hidden"); if (dom.selector) dom.selector.style.display = (mode === "pause") ? "none" : "";
  }
  function hideOverlay() { if (dom.overlay) dom.overlay.classList.add("is-hidden"); }

  function beginCountdown() { resetCar(); state.race = "countdown"; state.countT = 3.0; hideOverlay(); startLoop(); }
  function startGame() { if (state.race === "playing" || state.race === "countdown") return; if (state.race === "paused" && !state.wasCountdown) { state.race = "playing"; hideOverlay(); startLoop(); } else beginCountdown(); }
  function pauseGame() { if (state.race !== "playing" && state.race !== "countdown") return; state.wasCountdown = state.race === "countdown"; state.race = "paused"; resetInputs(); stopLoop(); render(); showOverlay("pause"); }
  function togglePause() { if (state.race === "playing" || state.race === "countdown") pauseGame(); else if (state.race === "paused") startGame(); }
  function restart() { beginCountdown(); }
  function changeTrack(dir) { if (state.race === "playing" || state.race === "countdown") return; loadTrack(trackIndex + dir); refreshSelector(); render(); }
  function toggleRacing() { state.racingOn = !state.racingOn; savePref("zuura_td_raceline", state.racingOn ? "1" : "0"); refreshSelector(); render(); }

  /* ---------- input ---------- */
  function syncSteer() { input.steer = (input.right ? 1 : 0) - (input.left ? 1 : 0); }
  function resetInputs() { input.left = input.right = input.gas = input.brake = false; input.steer = 0; if (dom.touch) { var a = dom.touch.querySelectorAll(".tbtn.active"); for (var i = 0; i < a.length; i++) a[i].classList.remove("active"); } }
  function onKey(e, down) {
    var k = e.key.toLowerCase(), move = true;
    if (k === "arrowleft" || k === "a") input.left = down; else if (k === "arrowright" || k === "d") input.right = down;
    else if (k === "arrowup" || k === "w") input.gas = down; else if (k === "arrowdown" || k === "s") input.brake = down; else move = false;
    if (down) {
      if (k === "p") togglePause(); else if (k === "r") restart(); else if (k === "l") toggleRacing();
      else if (k === "enter" || k === " ") { if (state.race !== "playing" && state.race !== "countdown") startGame(); }
      else if (k === "[") changeTrack(-1); else if (k === "]") changeTrack(1);
    }
    syncSteer(); if (move && (state.race === "playing" || state.race === "countdown")) e.preventDefault();
  }
  function bindButtons() {
    if (dom.touch) {
      var btns = dom.touch.querySelectorAll(".tbtn");
      for (var i = 0; i < btns.length; i++) (function (btn) {
        var act = btn.getAttribute("data-act");
        function set(v) {
          if (act === "line") { if (v) toggleRacing(); return; }
          if (act === "left") input.left = v; else if (act === "right") input.right = v; else if (act === "gas") input.gas = v; else if (act === "brake") input.brake = v;
          syncSteer(); btn.classList.toggle("active", v); if (v && state.race !== "playing" && state.race !== "countdown") startGame();
        }
        btn.addEventListener("pointerdown", function (e) { e.preventDefault(); if (btn.setPointerCapture) { try { btn.setPointerCapture(e.pointerId); } catch (x) {} } set(true); });
        btn.addEventListener("pointerup", function (e) { e.preventDefault(); set(false); });
        btn.addEventListener("pointercancel", function () { set(false); });
        btn.addEventListener("lostpointercapture", function () { set(false); });
      })(btns[i]);
    }
    if (dom.trkPrev) dom.trkPrev.addEventListener("click", function () { changeTrack(-1); });
    if (dom.trkNext) dom.trkNext.addEventListener("click", function () { changeTrack(1); });
    if (dom.lineToggle) dom.lineToggle.addEventListener("click", toggleRacing);
    if (dom.start) dom.start.addEventListener("click", function () { startGame(); });
  }

  /* ---------- loop / resize / debug ---------- */
  var rafId = 0, lastFrame = 0, acc = 0;
  function startLoop() { if (rafId) return; lastFrame = performance.now(); acc = 0; rafId = requestAnimationFrame(frame); }
  function stopLoop() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }
  function frame(now) {
    var dtReal = (now - lastFrame) / 1000; lastFrame = now; if (dtReal > 0.25) dtReal = 0.25;
    acc += dtReal; var steps = 0; while (acc >= STEP && steps < 8) { update(STEP); acc -= STEP; steps++; } if (acc > STEP) acc = 0;
    render(); updateHud(); if (DEBUG) updateDebug(dtReal);
    if (state.race === "playing" || state.race === "countdown") rafId = requestAnimationFrame(frame); else rafId = 0;
  }
  function resize() {
    var stage = dom.stage || document.getElementById("racerStage"), rect = stage.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1, cap = isCoarse ? 1 : 1.5;
    view.scale = Math.min(dpr, cap);
    view.w = canvas.width = Math.max(2, Math.round(rect.width * view.scale));
    view.h = canvas.height = Math.max(2, Math.round(rect.height * view.scale));
    view.ppwBase = Math.min(view.w, view.h) / VIEW_WORLD;
    ctx.imageSmoothingEnabled = true; render();
  }
  var resizeTimer = 0;
  function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); }
  var dbgEl = null;
  function updateDebug(dtReal) {
    if (!dbgEl) { dbgEl = document.createElement("div"); dbgEl.style.cssText = "position:absolute;right:8px;bottom:8px;z-index:6;font:11px/1.4 monospace;color:#D4A017;background:rgba(0,0,0,.6);padding:6px 8px;border:1px solid rgba(212,160,23,.4);white-space:pre;pointer-events:none"; (dom.stage || document.body).appendChild(dbgEl); }
    dbgEl.textContent = "[" + track.id + "] fps " + (dtReal > 0 ? (1 / dtReal).toFixed(0) : 0) + " s " + Math.round(state.s) + "/" + Math.round(L) + " half " + state.passedHalf + "\nlap " + state.currentLap + " kmh " + Math.round(car.speed * KMH_K) + " race " + state.racingOn + " gh " + (bestGhost ? bestGhost.length : 0) + " st " + state.race;
  }

  /* ---------- init ---------- */
  function init() {
    dom.stage = document.getElementById("racerStage"); dom.overlay = document.getElementById("racerOverlay");
    dom.title = document.getElementById("ovTitle"); dom.sub = document.getElementById("ovSub");
    dom.start = document.getElementById("racerStart"); dom.ovBest = document.getElementById("ovBest");
    dom.touch = document.getElementById("racerTouch"); dom.flash = document.getElementById("racerFlash");
    dom.lap = document.getElementById("hudLap"); dom.cur = document.getElementById("hudCur");
    dom.last = document.getElementById("hudLast"); dom.best = document.getElementById("hudBest"); dom.speed = document.getElementById("hudSpeed");
    dom.count = document.getElementById("tdCount"); dom.selector = document.getElementById("trkSelector");
    dom.trkPrev = document.getElementById("trkPrev"); dom.trkNext = document.getElementById("trkNext");
    dom.trkName = document.getElementById("trkName"); dom.trkCountry = document.getElementById("trkCountry");
    dom.lineToggle = document.getElementById("lineToggle"); dom.lineBtn = dom.touch ? dom.touch.querySelector('[data-act="line"]') : null;

    loadPrefs(); loadTrack(trackIndex);
    showOverlay("ready"); updateHud();
    window.addEventListener("keydown", function (e) { onKey(e, true); });
    window.addEventListener("keyup", function (e) { onKey(e, false); });
    bindButtons();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", function () { setTimeout(resize, 300); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) pauseGame(); });
    window.addEventListener("blur", function () { pauseGame(); });
    document.addEventListener("zuura:drawer", function (e) { if (e.detail && e.detail.open) pauseGame(); });

    if (DEBUG) window.ZTD = {
      state: state, car: car, input: input, track: function () { return track; }, tracks: TRACKS, NPTS: function () { return NPTS; }, L: function () { return L; },
      step: function (n) { n = n || 1; for (var i = 0; i < n; i++) update(STEP); },
      setCarToIndex: function (i) { car.x = C[i % NPTS].x; car.y = C[i % NPTS].y; },
      changeTrack: changeTrack, toggleRacing: toggleRacing, beginCountdown: beginCountdown
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

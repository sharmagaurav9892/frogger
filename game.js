/* =====================================================================
 * Frogger
 * Arrow keys / WASD to hop. Space pauses. R restarts.
 * Cross 5 lanes of traffic, ride logs and turtles, reach all 5 lily pads.
 * ===================================================================== */

(() => {
  "use strict";

  // -------------------- Config --------------------
  const COLS = 13;
  const ROWS = 13;
  const RIVER_ROWS = [1, 2, 3, 4, 5];
  const ROAD_ROWS = [7, 8, 9, 10, 11];
  const GOAL_COLS = [1, 4, 6, 8, 11];
  const LIVES_START = 3;
  const MAX_LEADERS = 3;
  const HOP_ANIM_MS = 140;
  const DEATH_HOLD_MS = 700;
  const SCORE_GOAL = 50;
  const SCORE_LEVEL_BONUS = 100;

  const COLORS = {
    boardBg:   "#0b0e13",
    river:     "#22467a",
    riverDark: "#1a3760",
    road:      "#2a2f3a",
    roadEdge:  "#1a1e26",
    roadLine:  "#f0b429",
    grass:     "#1e5a3a",
    grassDark: "#174a30",
    padEmpty:  "#0e3a26",
    padFilled: "#22c997",
    frog:      "#22c997",
    frogDark:  "#10805f",
    frogLite:  "#54e6b8",
    eyeWhite:  "#f5fffb",
    eyeDark:   "#08171f",
    log:       "#7a4d27",
    logDark:   "#5a371b",
    logLite:   "#9a663a",
    turtle:    "#3a9c54",
    turtleDk:  "#1e6a33",
    sedan:     "#e5484d",
    truck:     "#3b82f6",
    taxi:      "#f0b429",
    racer:     "#a855f7",
  };

  const LS_KEYS = {
    name: "frogger.player",
    leaderboard: "frogger.leaderboard",
  };

  // -------------------- DOM --------------------
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const els = {
    scoreValue: document.getElementById("scoreValue"),
    livesValue: document.getElementById("livesValue"),
    levelValue: document.getElementById("levelValue"),
    playerName: document.getElementById("playerName"),
    changePlayerBtn: document.getElementById("changePlayerBtn"),
    overlayStart:  document.getElementById("overlayStart"),
    overlayPaused: document.getElementById("overlayPaused"),
    overlayOver:   document.getElementById("overlayOver"),
    overScore: document.getElementById("overScore"),
    overBest:  document.getElementById("overBest"),
    overTitle: document.getElementById("overTitle"),
    overMsg:   document.getElementById("overMsg"),
    playAgainBtn: document.getElementById("playAgainBtn"),
    leaderboardList: document.getElementById("leaderboardList"),
    resetScoresBtn: document.getElementById("resetScoresBtn"),
    nameModal: document.getElementById("nameModal"),
    nameForm:  document.getElementById("nameForm"),
    nameInput: document.getElementById("nameInput"),
    nameCancelBtn: document.getElementById("nameCancelBtn"),
    touchPause: document.getElementById("touchPause"),
    touchUp:    document.getElementById("touchUp"),
    touchDown:  document.getElementById("touchDown"),
    touchLeft:  document.getElementById("touchLeft"),
    touchRight: document.getElementById("touchRight"),
  };

  const PLAY_ICON  = "\u25B6";
  const PAUSE_ICON = "\u275A\u275A";

  // -------------------- State --------------------
  const state = {
    status: "idle", // idle | playing | paused | over | leveling
    frog: { x: 6, y: 12, dir: "Up", hopAt: 0 },
    lanes: [],
    goals: [false, false, false, false, false],
    score: 0,
    lives: LIVES_START,
    level: 1,
    lastFrame: 0,
    shake: 0,
    deathAt: 0,
    deathCause: null,
    player: "",
    leaders: [],
  };

  // -------------------- Audio --------------------
  let audio = null;
  function ensureAudio() {
    if (!audio) {
      try { audio = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (_) { audio = null; }
    }
    if (audio && audio.state === "suspended") audio.resume();
  }
  function beep(freq = 660, dur = 0.08, type = "triangle", gain = 0.04) {
    if (!audio) return;
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  const sfx = {
    hop()    { beep(720, 0.05, "triangle", 0.05); setTimeout(() => beep(960, 0.04, "triangle", 0.04), 30); },
    splash() { beep(220, 0.12, "sawtooth", 0.05); setTimeout(() => beep(140, 0.20, "sine", 0.06), 60); },
    crash()  { beep(280, 0.10, "sawtooth", 0.06); setTimeout(() => beep(160, 0.16, "sawtooth", 0.07), 80); setTimeout(() => beep(90, 0.22, "sawtooth", 0.07), 180); },
    goal()   { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.09), i * 70)); },
    levelClear() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => beep(f, 0.13, "triangle", 0.05), i * 80));
      setTimeout(() => { beep(523, 0.30, "triangle", 0.04); beep(659, 0.30, "triangle", 0.04); beep(784, 0.30, "triangle", 0.04); }, 520);
    },
    gameOver() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.22, "sawtooth", 0.06), i * 130)); },
    pause()  { beep(440, 0.05); },
    resume() { beep(660, 0.05); },
  };

  // -------------------- Storage --------------------
  function loadPlayer() {
    try { return localStorage.getItem(LS_KEYS.name) || ""; }
    catch (_) { return ""; }
  }
  function savePlayer(name) {
    try { localStorage.setItem(LS_KEYS.name, name); } catch (_) {}
  }
  function loadLeadersLocal() {
    try {
      const raw = localStorage.getItem(LS_KEYS.leaderboard);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr
        .filter(e => e && typeof e.score === "number" && typeof e.name === "string")
        .slice(0, MAX_LEADERS);
    } catch (_) { return []; }
  }
  function saveLeadersLocal(list) {
    try { localStorage.setItem(LS_KEYS.leaderboard, JSON.stringify(list.slice(0, MAX_LEADERS))); }
    catch (_) {}
  }
  function setLeaders(list) {
    state.leaders = (list || []).slice(0, MAX_LEADERS);
    saveLeadersLocal(state.leaders);
    renderLeaderboard();
  }

  // -------------------- Lane setup --------------------
  function buildLanes(level) {
    const speedMul = 1 + 0.18 * (level - 1);
    const lanes = [];

    // ROAD (rows 7..11)
    const roadDefs = [
      { row: 11, dir: -1, speed: 1.4, w: 2.3, color: COLORS.truck,  spacing: 5.0 },
      { row: 10, dir:  1, speed: 2.0, w: 1.5, color: COLORS.taxi,   spacing: 4.0 },
      { row:  9, dir: -1, speed: 3.2, w: 1.0, color: COLORS.racer,  spacing: 4.5 },
      { row:  8, dir:  1, speed: 2.2, w: 1.0, color: COLORS.sedan,  spacing: 3.5 },
      { row:  7, dir: -1, speed: 1.1, w: 2.6, color: COLORS.truck,  spacing: 5.5 },
    ];
    for (const d of roadDefs) {
      const totalW = d.w + d.spacing;
      const count = Math.max(2, Math.ceil((COLS + d.w + 4) / totalW));
      const span = count * totalW;
      const phase = Math.random() * totalW;
      const ents = [];
      for (let i = 0; i < count; i++) {
        ents.push({ x: i * totalW - 2 + phase, w: d.w, color: d.color });
      }
      lanes.push({ row: d.row, type: "road", dir: d.dir, speed: d.speed * speedMul, entities: ents, span });
    }

    // RIVER (rows 1..5)
    const riverDefs = [
      { row: 5, dir:  1, speed: 1.4, kind: "log",    w: 3.0, spacing: 3.0 },
      { row: 4, dir: -1, speed: 1.8, kind: "turtle", w: 3.0, spacing: 3.5, divePeriod: 4.5 },
      { row: 3, dir:  1, speed: 1.2, kind: "log",    w: 4.0, spacing: 4.0 },
      { row: 2, dir: -1, speed: 2.0, kind: "turtle", w: 3.0, spacing: 4.0, divePeriod: 5.5 },
      { row: 1, dir:  1, speed: 1.7, kind: "log",    w: 2.5, spacing: 3.2 },
    ];
    for (const d of riverDefs) {
      const totalW = d.w + d.spacing;
      const count = Math.max(2, Math.ceil((COLS + d.w + 4) / totalW));
      const span = count * totalW;
      const phase = Math.random() * totalW;
      const ents = [];
      for (let i = 0; i < count; i++) {
        const ent = { x: i * totalW - 2 + phase, w: d.w, kind: d.kind };
        if (d.kind === "turtle") {
          ent.divePeriod = d.divePeriod;
          ent.divePhase  = Math.random() * d.divePeriod;
          ent.diving = false;
        }
        ents.push(ent);
      }
      lanes.push({ row: d.row, type: "river", dir: d.dir, speed: d.speed * speedMul, entities: ents, span, kind: d.kind });
    }

    return lanes;
  }

  // -------------------- Game lifecycle --------------------
  function resetFrog() {
    state.frog = { x: 6, y: 12, dir: "Up", hopAt: 0 };
  }
  function resetLevel() {
    state.lanes = buildLanes(state.level);
    state.goals = [false, false, false, false, false];
    resetFrog();
    state.deathAt = 0;
    state.deathCause = null;
  }
  function resetGame() {
    state.score = 0;
    state.lives = LIVES_START;
    state.level = 1;
    resetLevel();
    state.shake = 0;
    updateHud();
  }
  function startGame() {
    if (state.status === "playing") return;
    if (state.status === "over" || state.status === "idle") resetGame();
    state.status = "playing";
    state.lastFrame = performance.now();
    hideAllOverlays();
    updateTouchPauseIcon();
  }
  function pauseGame() {
    if (state.status !== "playing") return;
    state.status = "paused";
    showOverlay("paused");
    sfx.pause();
    updateTouchPauseIcon();
  }
  function resumeGame() {
    if (state.status !== "paused") return;
    state.status = "playing";
    state.lastFrame = performance.now();
    hideOverlay("paused");
    sfx.resume();
    updateTouchPauseIcon();
  }
  function togglePause() {
    if (state.status === "idle" || state.status === "over") startGame();
    else if (state.status === "playing") pauseGame();
    else if (state.status === "paused")  resumeGame();
  }
  function endGame() {
    state.status = "over";
    state.shake = 280;
    sfx.gameOver();
    updateTouchPauseIcon();

    const topBefore = getTopScore();
    submitToLeaderboard(state.player, state.score);
    const topAfter = getTopScore();
    const isHigh = state.score > 0 && topAfter > topBefore && topAfter === state.score;

    els.overScore.textContent = String(state.score);
    els.overBest.textContent  = String(topAfter);
    els.overTitle.textContent = pickGameOverTitle(state.score, isHigh);
    els.overMsg.innerHTML = isHigh
      ? `New high score! Press <span class="kbd">Space</span> or <span class="kbd">R</span> to play again.`
      : `Press <span class="kbd">Space</span> or <span class="kbd">R</span> to play again.`;
    showOverlay("over");
    renderLeaderboard();
  }
  function pickGameOverTitle(score, isHigh) {
    if (isHigh)        return "New high score!";
    if (score === 0)   return "Splat on the first hop.";
    if (score < 100)   return "Got squished.";
    if (score < 300)   return "Decent hopping.";
    if (score < 600)   return "Highway hero.";
    return "Legendary leaper.";
  }

  // -------------------- Death & Goals --------------------
  function killFrog(cause) {
    if (state.deathAt) return;
    state.deathAt = performance.now();
    state.deathCause = cause;
    state.shake = 180;
    if (cause === "drown" || cause === "edge") sfx.splash();
    else sfx.crash();
    state.lives -= 1;
    bumpStat(els.livesValue.parentElement);
    updateHud();
    setTimeout(() => {
      if (state.lives <= 0) {
        endGame();
      } else {
        resetFrog();
        state.deathAt = 0;
        state.deathCause = null;
      }
    }, DEATH_HOLD_MS);
  }

  function reachGoal(slotIndex) {
    state.goals[slotIndex] = true;
    state.score += SCORE_GOAL;
    bumpStat(els.scoreValue.parentElement);
    sfx.goal();
    updateHud();
    if (state.goals.every(g => g)) {
      state.score += SCORE_LEVEL_BONUS;
      state.level += 1;
      bumpStat(els.levelValue.parentElement);
      state.status = "leveling";
      sfx.levelClear();
      updateTouchPauseIcon();
      setTimeout(() => {
        resetLevel();
        state.status = "playing";
        state.lastFrame = performance.now();
        updateHud();
        updateTouchPauseIcon();
      }, 900);
    } else {
      resetFrog();
    }
  }

  // -------------------- Hop --------------------
  function hop(dir) {
    if (state.status === "idle" || state.status === "over") { startGame(); return; }
    if (state.status !== "playing") return;
    if (state.deathAt) return;
    const f = state.frog;
    let nx = f.x, ny = f.y;
    if (dir === "Up") ny -= 1;
    else if (dir === "Down") ny += 1;
    else if (dir === "Left")  nx = Math.round(f.x) - 1;
    else if (dir === "Right") nx = Math.round(f.x) + 1;
    if (ny < 0 || ny > ROWS - 1) return;
    if ((dir === "Left" || dir === "Right") && (nx < 0 || nx > COLS - 1)) return;
    f.dir = dir;
    f.x = nx;
    f.y = ny;
    f.hopAt = performance.now();
    sfx.hop();
  }

  function bumpStat(node) {
    if (!node) return;
    node.classList.remove("stat--bump");
    void node.offsetWidth;
    node.classList.add("stat--bump");
  }

  // -------------------- World update --------------------
  function updateWorld(dt) {
    const dts = dt / 1000;

    for (const lane of state.lanes) {
      for (const ent of lane.entities) {
        ent.x += lane.dir * lane.speed * dts;
        if (lane.dir > 0 && ent.x > COLS + 2) ent.x -= lane.span;
        if (lane.dir < 0 && ent.x + ent.w < -2) ent.x += lane.span;
      }
      if (lane.type === "river" && lane.kind === "turtle") {
        for (const ent of lane.entities) {
          ent.divePhase = (ent.divePhase + dts) % ent.divePeriod;
          const p = ent.divePhase / ent.divePeriod;
          ent.diving = p > 0.74 && p < 0.92;
        }
      }
    }

    if (state.deathAt) return;

    const f = state.frog;
    const fRow = f.y;
    const fxCenter = f.x + 0.5;

    if (RIVER_ROWS.indexOf(fRow) >= 0) {
      const lane = state.lanes.find(l => l.row === fRow);
      if (lane) {
        let carrier = null;
        for (const ent of lane.entities) {
          if (lane.kind === "turtle" && ent.diving) continue;
          if (fxCenter >= ent.x && fxCenter <= ent.x + ent.w) { carrier = ent; break; }
        }
        if (!carrier) { killFrog("drown"); return; }
        f.x += lane.dir * lane.speed * dts;
        if (f.x < -0.4 || f.x > COLS - 0.6) { killFrog("edge"); return; }
      }
    }

    if (ROAD_ROWS.indexOf(fRow) >= 0) {
      const lane = state.lanes.find(l => l.row === fRow);
      if (lane) {
        const fxL = f.x + 0.18;
        const fxR = f.x + 0.82;
        for (const ent of lane.entities) {
          if (fxR > ent.x && fxL < ent.x + ent.w) { killFrog("crash"); return; }
        }
      }
    }

    if (fRow === 0) {
      const fc = Math.round(f.x);
      const slot = GOAL_COLS.indexOf(fc);
      if (slot >= 0 && !state.goals[slot]) reachGoal(slot);
      else killFrog("drown");
    }
  }

  // -------------------- Rendering --------------------
  function cellSize() { return canvas.width / COLS; }

  function draw(now) {
    const w = canvas.width;
    const h = canvas.height;
    const cs = cellSize();

    let ox = 0, oy = 0;
    if (state.shake > 0) {
      const mag = Math.min(6, state.shake / 50);
      ox = (Math.random() - 0.5) * mag;
      oy = (Math.random() - 0.5) * mag;
    }

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(ox, oy);

    ctx.fillStyle = COLORS.boardBg;
    ctx.fillRect(0, 0, w, h);

    // Bands
    fillRow(0, 1, COLORS.grass, cs);     // goal bank
    fillRow(1, 5, COLORS.river, cs);     // river
    fillRow(6, 1, COLORS.grass, cs);     // median
    fillRow(7, 5, COLORS.road, cs);      // road
    fillRow(12, 1, COLORS.grass, cs);    // start

    // Road edges
    ctx.fillStyle = COLORS.roadEdge;
    ctx.fillRect(0, 7 * cs, w, 3);
    ctx.fillRect(0, 12 * cs - 3, w, 3);

    // Dashed lane lines
    ctx.strokeStyle = COLORS.roadLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([cs * 0.32, cs * 0.28]);
    for (let r = 8; r <= 11; r++) {
      const y = r * cs;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Grass texture flecks
    ctx.fillStyle = COLORS.grassDark;
    for (const row of [0, 6, 12]) {
      for (let i = 0; i < 30; i++) {
        const gx = ((i * 73 + row * 31) % w);
        const gy = row * cs + ((i * 47) % cs);
        ctx.fillRect(gx, gy, 2, 3);
      }
    }

    // River shimmer
    drawRiverShimmer(now, cs);

    // Goal pads
    for (let i = 0; i < GOAL_COLS.length; i++) {
      drawGoalSlot(GOAL_COLS[i], state.goals[i], cs);
    }

    // Lanes
    for (const lane of state.lanes) {
      if (lane.type === "road") drawRoadLane(lane, cs);
      else drawRiverLane(lane, cs);
    }

    // Frog
    drawFrog(cs);

    // Lives indicator
    drawLivesIndicator(cs);

    ctx.restore();
  }

  function fillRow(startRow, count, color, cs) {
    ctx.fillStyle = color;
    ctx.fillRect(0, startRow * cs, canvas.width, count * cs);
  }

  function drawRiverShimmer(now, cs) {
    ctx.strokeStyle = COLORS.riverDark;
    ctx.lineWidth = 1;
    const t = now * 0.001;
    for (let r = 1; r <= 5; r++) {
      const y = r * cs + cs * 0.5;
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += 6) {
        const yy = y + Math.sin((x + t * 28 + r * 50) * 0.05) * 1.6;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }

  function drawGoalSlot(col, filled, cs) {
    const cx = (col + 0.5) * cs;
    const cy = 0.5 * cs;
    const r  = cs * 0.42;
    ctx.fillStyle = filled ? COLORS.padFilled : COLORS.padEmpty;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    if (filled) {
      ctx.fillStyle = COLORS.frogDark;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.eyeWhite;
      ctx.beginPath(); ctx.arc(cx - r * 0.22, cy - r * 0.10, r * 0.10, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + r * 0.22, cy - r * 0.10, r * 0.10, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = COLORS.grassDark;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawRoadLane(lane, cs) {
    const y = lane.row * cs;
    for (const ent of lane.entities) {
      const x = ent.x * cs;
      const w = ent.w * cs;
      drawVehicle(x, y, w, cs, ent.color, lane.dir);
    }
  }

  function drawVehicle(x, y, w, h, color, dir) {
    const pad = h * 0.14;
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    roundRect(x + 1, y + pad + 2, w - 2, h - pad * 2, h * 0.18);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(x + 1, y + pad, w - 2, h - pad * 2, h * 0.18);
    ctx.fill();
    // Windows
    ctx.fillStyle = "rgba(255,255,255,0.20)";
    const wpad = h * 0.24;
    const ww = (w - 2) * 0.28;
    if (dir > 0) {
      roundRect(x + w - 1 - ww - wpad * 0.5, y + wpad, ww, h - wpad * 2, h * 0.08);
    } else {
      roundRect(x + 1 + wpad * 0.5, y + wpad, ww, h - wpad * 2, h * 0.08);
    }
    ctx.fill();
    // Headlights
    ctx.fillStyle = "rgba(255, 240, 180, 0.85)";
    const lr = h * 0.07;
    const hx = dir > 0 ? x + w - 2 : x + 2;
    ctx.beginPath(); ctx.arc(hx, y + pad + lr * 1.3, lr, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx, y + h - pad - lr * 1.3, lr, 0, Math.PI * 2); ctx.fill();
  }

  function drawRiverLane(lane, cs) {
    const y = lane.row * cs;
    for (const ent of lane.entities) {
      const x = ent.x * cs;
      const w = ent.w * cs;
      if (lane.kind === "log") drawLog(x, y, w, cs);
      else drawTurtleGroup(x, y, w, cs, ent.diving);
    }
  }

  function drawLog(x, y, w, cs) {
    const pad = cs * 0.13;
    ctx.fillStyle = COLORS.logDark;
    roundRect(x, y + pad, w, cs - pad * 2, cs * 0.32);
    ctx.fill();
    ctx.fillStyle = COLORS.log;
    roundRect(x + 2, y + pad + 2, w - 4, cs - pad * 2 - 4, cs * 0.28);
    ctx.fill();
    ctx.strokeStyle = COLORS.logDark;
    ctx.lineWidth = 1;
    const segs = Math.max(1, Math.round(w / cs));
    for (let i = 1; i < segs; i++) {
      const lx = x + (i * w) / segs;
      ctx.beginPath();
      ctx.moveTo(lx, y + pad + 4);
      ctx.lineTo(lx, y + cs - pad - 4);
      ctx.stroke();
    }
    ctx.strokeStyle = COLORS.logLite;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + cs * 0.30);
    ctx.lineTo(x + w - 4, y + cs * 0.30);
    ctx.stroke();
  }

  function drawTurtleGroup(x, y, w, cs, diving) {
    const n = 3;
    const tw = w / n;
    for (let i = 0; i < n; i++) {
      const cx = x + (i + 0.5) * tw;
      const cy = y + cs * 0.5;
      const r  = Math.min(tw, cs) * 0.40;
      if (diving) {
        ctx.strokeStyle = COLORS.riverDark;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      ctx.fillStyle = COLORS.turtleDk;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.turtle;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = COLORS.turtleDk;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx - r * 0.55, cy); ctx.lineTo(cx + r * 0.55, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.55); ctx.lineTo(cx, cy + r * 0.55); ctx.stroke();
      ctx.fillStyle = COLORS.turtle;
      ctx.beginPath(); ctx.arc(cx + r * 0.92, cy, r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.eyeDark;
      ctx.beginPath(); ctx.arc(cx + r * 1.0, cy - r * 0.05, r * 0.07, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawFrog(cs) {
    const f = state.frog;
    const now = performance.now();
    const cx = (f.x + 0.5) * cs;
    const cy = (f.y + 0.5) * cs;

    let alpha = 1;
    if (state.deathAt) {
      const t = (now - state.deathAt) / DEATH_HOLD_MS;
      alpha = Math.max(0.15, 1 - t);
    }

    const hopElapsed = now - f.hopAt;
    const hopT = Math.min(1, Math.max(0, hopElapsed / HOP_ANIM_MS));
    const lift = Math.sin(hopT * Math.PI) * cs * 0.20;

    let dx = 0, dy = -1;
    if (f.dir === "Up")    { dx = 0;  dy = -1; }
    else if (f.dir === "Down")  { dx = 0;  dy =  1; }
    else if (f.dir === "Left")  { dx = -1; dy =  0; }
    else if (f.dir === "Right") { dx = 1;  dy =  0; }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy - lift);

    const r = cs * 0.36;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, r + lift * 0.6 + 2, r * 0.9, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rotate facing direction (body oriented along travel axis)
    const ang = Math.atan2(dy, dx) + Math.PI / 2;
    ctx.rotate(ang);

    // Body outline
    ctx.fillStyle = COLORS.frogDark;
    roundRectAt(-r, -r * 0.95, r * 2, r * 1.85, r * 0.55);
    ctx.fill();
    // Body main
    ctx.fillStyle = COLORS.frog;
    roundRectAt(-r * 0.92, -r * 0.88, r * 1.84, r * 1.7, r * 0.50);
    ctx.fill();
    // Back stripe
    ctx.fillStyle = COLORS.frogLite;
    roundRectAt(-r * 0.50, -r * 0.55, r * 1.0, r * 0.22, r * 0.10);
    ctx.fill();

    // Legs at corners
    ctx.fillStyle = COLORS.frogDark;
    const legStretch = 1 - hopT;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * r * 0.78, sy * r * (0.70 + legStretch * 0.06), r * 0.24, r * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Eyes near the front
    const eOff = r * 0.45;
    const eF   = r * 0.62;
    for (const sgn of [-1, 1]) {
      const ex = sgn * eOff;
      const ey = -eF;
      ctx.fillStyle = COLORS.frog;
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.eyeWhite;
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.eyeDark;
      ctx.beginPath(); ctx.arc(ex, ey - r * 0.04, r * 0.07, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawLivesIndicator(cs) {
    const y = 12 * cs + cs * 0.18;
    for (let i = 0; i < state.lives - 1; i++) {
      const x = cs * 0.3 + i * cs * 0.40;
      ctx.fillStyle = COLORS.frog;
      ctx.beginPath(); ctx.arc(x, y, cs * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.eyeWhite;
      ctx.beginPath(); ctx.arc(x - 3, y - 2, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 3, y - 2, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }
  function roundRectAt(x, y, w, h, r) {
    roundRect(x, y, w, h, r);
  }

  // -------------------- Loop --------------------
  function loop(now) {
    const dt = Math.min(50, now - state.lastFrame);
    state.lastFrame = now;
    if (state.status === "playing") updateWorld(dt);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
    draw(now);
    requestAnimationFrame(loop);
  }

  // -------------------- HUD / overlays --------------------
  function updateHud() {
    els.scoreValue.textContent = String(state.score);
    els.livesValue.textContent = String(state.lives);
    els.levelValue.textContent = String(state.level);
    els.playerName.textContent = state.player || "Guest";
  }
  function getTopScore() { return state.leaders.length ? state.leaders[0].score : 0; }
  function showOverlay(which) {
    if (which === "start")  els.overlayStart.classList.remove("hidden");
    if (which === "paused") els.overlayPaused.classList.remove("hidden");
    if (which === "over")   els.overlayOver.classList.remove("hidden");
  }
  function hideOverlay(which) {
    if (which === "start")  els.overlayStart.classList.add("hidden");
    if (which === "paused") els.overlayPaused.classList.add("hidden");
    if (which === "over")   els.overlayOver.classList.add("hidden");
  }
  function hideAllOverlays() {
    hideOverlay("start"); hideOverlay("paused"); hideOverlay("over");
  }
  function updateTouchPauseIcon() {
    if (!els.touchPause) return;
    const playing = state.status === "playing";
    els.touchPause.textContent = playing ? PAUSE_ICON : PLAY_ICON;
    els.touchPause.setAttribute("aria-label", playing ? "Pause" : "Play");
  }

  function bindTouchControls() {
    const dirMap = [
      [els.touchUp,    "Up"],
      [els.touchDown,  "Down"],
      [els.touchLeft,  "Left"],
      [els.touchRight, "Right"],
    ];
    for (const [btn, dirName] of dirMap) {
      if (!btn) continue;
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        ensureAudio();
        hop(dirName);
      });
      btn.addEventListener("click", (e) => e.preventDefault());
    }
    if (els.touchPause) {
      els.touchPause.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        ensureAudio();
        togglePause();
        updateTouchPauseIcon();
      });
      els.touchPause.addEventListener("click", (e) => e.preventDefault());
    }
  }

  // -------------------- Leaderboard --------------------
  function submitToLeaderboard(name, score) {
    if (!name || score <= 0) return;
    const merged = state.leaders.concat([{ name, score, at: Date.now() }]);
    merged.sort((a, b) => b.score - a.score || a.at - b.at);
    setLeaders(merged);
  }
  function renderLeaderboard() {
    const list = state.leaders;
    els.leaderboardList.innerHTML = "";
    if (!list.length) {
      const li = document.createElement("li");
      li.className = "leaderboard__empty";
      li.textContent = "No scores yet.";
      els.leaderboardList.appendChild(li);
      return;
    }
    list.forEach((entry, idx) => {
      const li = document.createElement("li");
      if (entry.name === state.player) li.classList.add("you");
      li.innerHTML = `
        <span class="lb-rank">${idx + 1}</span>
        <span class="lb-name">${escapeHtml(entry.name)}</span>
        <span class="lb-score">${entry.score}</span>
      `;
      els.leaderboardList.appendChild(li);
    });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // -------------------- Input --------------------
  function onKeyDown(e) {
    if (document.activeElement === els.nameInput) return;
    const k = e.key;
    if (k === "ArrowUp" || k === "w" || k === "W") {
      e.preventDefault(); ensureAudio(); hop("Up");
    } else if (k === "ArrowDown" || k === "s" || k === "S") {
      e.preventDefault(); ensureAudio(); hop("Down");
    } else if (k === "ArrowLeft" || k === "a" || k === "A") {
      e.preventDefault(); ensureAudio(); hop("Left");
    } else if (k === "ArrowRight" || k === "d" || k === "D") {
      e.preventDefault(); ensureAudio(); hop("Right");
    } else if (k === " " || k === "Spacebar") {
      e.preventDefault(); ensureAudio(); togglePause();
    } else if (k === "r" || k === "R") {
      e.preventDefault(); ensureAudio();
      resetGame();
      state.status = "playing";
      state.lastFrame = performance.now();
      hideAllOverlays();
      updateTouchPauseIcon();
    }
  }

  // -------------------- Player name modal --------------------
  let wasPlayingBeforeModal = false;
  function openNameModal(canCancel) {
    els.nameModal.classList.remove("hidden");
    els.nameModal.setAttribute("aria-hidden", "false");
    els.nameInput.value = state.player || "";
    wasPlayingBeforeModal = state.status === "playing";
    if (wasPlayingBeforeModal) pauseGame();
    if (canCancel) els.nameCancelBtn.classList.remove("hidden");
    else els.nameCancelBtn.classList.add("hidden");
    setTimeout(() => { els.nameInput.focus(); els.nameInput.select(); }, 30);
  }
  function closeNameModal() {
    els.nameModal.classList.add("hidden");
    els.nameModal.setAttribute("aria-hidden", "true");
  }

  els.nameForm.addEventListener("submit", e => {
    e.preventDefault();
    const clean = els.nameInput.value.trim().replace(/\s+/g, " ").slice(0, 14);
    if (!clean) return;
    state.player = clean;
    savePlayer(clean);
    updateHud();
    renderLeaderboard();
    closeNameModal();
  });
  els.nameCancelBtn.addEventListener("click", () => {
    if (!state.player) return;
    closeNameModal();
  });
  els.changePlayerBtn.addEventListener("click", e => {
    e.stopPropagation();
    openNameModal(true);
  });
  els.playAgainBtn.addEventListener("click", () => startGame());
  els.resetScoresBtn.addEventListener("click", () => {
    if (confirm("Clear the Top 3 leaderboard?")) setLeaders([]);
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !els.nameModal.classList.contains("hidden") && state.player) closeNameModal();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.status === "playing") pauseGame();
  });

  // -------------------- DPI / resize --------------------
  function fitCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // [fit-board] Desktop: fit the board into the stage's available area so it
    // never overflows and the footer stays visible. Touch keeps CSS sizing.
    if (!document.documentElement.classList.contains("is-touch")) {
      const _wrap = canvas.parentElement;
      const _stage = _wrap.parentElement;
      const _cs = getComputedStyle(_wrap);
      const _gap = parseFloat(getComputedStyle(_stage).rowGap) || 0;
      const _wr = _wrap.getBoundingClientRect();
      let _budget = _stage.clientHeight;
      for (const _sib of _stage.children) {
        if (_sib === _wrap) continue;
        const _r = _sib.getBoundingClientRect();
        if (_r.top >= _wr.bottom - 2) _budget -= _r.height + _gap;
      }
      const _availW = _wrap.clientWidth
        - parseFloat(_cs.paddingLeft) - parseFloat(_cs.paddingRight);
      const _availH = _budget
        - parseFloat(_cs.paddingTop) - parseFloat(_cs.paddingBottom)
        - parseFloat(_cs.borderTopWidth) - parseFloat(_cs.borderBottomWidth);
      if (_availW > 0 && _availH > 0) {
        let _cw = _availW, _ch = _cw * (650 / 650);
        if (_ch > _availH) { _ch = _availH; _cw = _ch * (650 / 650); }
        canvas.style.width = Math.floor(_cw) + "px";
        canvas.style.height = Math.floor(_ch) + "px";
      }
    } else {
      canvas.style.width = "";
      canvas.style.height = "";
    }
    const rect = canvas.getBoundingClientRect();
    const target = Math.round(Math.min(rect.width, rect.height) * dpr);
    const snapped = Math.max(COLS * 28, Math.floor(target / COLS) * COLS);
    if (canvas.width !== snapped) {
      canvas.width = snapped;
      canvas.height = snapped;
    }
  }
  window.addEventListener("resize", fitCanvas);

  // -------------------- Init --------------------
  function init() {
    document.addEventListener("keydown", onKeyDown);
    bindTouchControls();

    state.player = loadPlayer();

    fitCanvas();
    resetGame();

    state.leaders = loadLeadersLocal();
    renderLeaderboard();
    updateHud();
    updateTouchPauseIcon();

    showOverlay("start");

    if (!state.player) openNameModal(false);

    requestAnimationFrame(t => {
      state.lastFrame = t;
      loop(t);
    });
  }
  init();
})();

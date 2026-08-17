/**
 * 一二三木頭人 — red light / green light race. Original pacing & visuals.
 */

export const W = 480;
export const H = 560;
export const MAX_LIVES = 3;
export const FINISH = 1;
export const STORAGE_KEY = "pg-statue-best";

/** @typedef {'ready'|'playing'|'won'|'lost'} GameStatus */
/** @typedef {'away'|'watching'} RefereeState */

/**
 * @typedef {{
 *   id: string,
 *   lane: number,
 *   progress: number,
 *   speed: number,
 *   moving: boolean,
 *   caughtFlash: number,
 *   finished: boolean,
 *   finishTime: number | null,
 *   isPlayer: boolean,
 *   color: string,
 *   name: string,
 * }} Runner
 */

const COUNT_LABELS = ["一", "二", "三", "木頭人！"];

/**
 * @returns {Runner[]}
 */
function makeRunners() {
  return [
    {
      id: "you",
      lane: 1,
      progress: 0,
      speed: 0.26,
      moving: false,
      caughtFlash: 0,
      finished: false,
      finishTime: null,
      isPlayer: true,
      color: "#2563eb",
      name: "你",
    },
    {
      id: "ai1",
      lane: 0,
      progress: 0,
      speed: 0.22,
      moving: false,
      caughtFlash: 0,
      finished: false,
      finishTime: null,
      isPlayer: false,
      color: "#ea580c",
      name: "小橙",
    },
    {
      id: "ai2",
      lane: 2,
      progress: 0,
      speed: 0.19,
      moving: false,
      caughtFlash: 0,
      finished: false,
      finishTime: null,
      isPlayer: false,
      color: "#7c3aed",
      name: "小紫",
    },
  ];
}

/**
 * @returns {{ wins: number, bestTime: number | null }}
 */
export function loadBest() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { wins: 0, bestTime: null };
    const data = JSON.parse(raw);
    return {
      wins: Number(data.wins) || 0,
      bestTime:
        typeof data.bestTime === "number" && data.bestTime > 0
          ? data.bestTime
          : null,
    };
  } catch {
    return { wins: 0, bestTime: null };
  }
}

/**
 * @param {{ wins: number, bestTime: number | null }} best
 */
export function saveBest(best) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(best));
  } catch {
    /* quota / private mode */
  }
  // KV 為權威；LS 僅快取
  void fetch(`/api/kv/${STORAGE_KEY}`, { method: "PUT", body: JSON.stringify(best) }).catch(() => {});
}

/**
 * KV 為權威；本地快取過舊時以遠端為準（wins 取大、bestTime 取小）
 * @param {{ wins: number, bestTime: number | null }} current
 * @returns {Promise<{ wins: number, bestTime: number | null }>}
 */
export async function mergeBestFromKv(current) {
  try {
    const res = await fetch(`/api/kv/${STORAGE_KEY}`);
    if (!res.ok) return current;
    const data = JSON.parse((await res.text()) || "null");
    if (!data) return current;
    const wins = Math.max(current.wins, Number(data.wins) || 0);
    const remoteTime =
      typeof data.bestTime === "number" && data.bestTime > 0 ? data.bestTime : null;
    const bestTime =
      current.bestTime == null
        ? remoteTime
        : remoteTime == null
          ? current.bestTime
          : Math.min(current.bestTime, remoteTime);
    return { wins, bestTime };
  } catch {
    /* 無 KV 環境照玩 */
    return current;
  }
}

export class StatueGame {
  constructor() {
    /** @type {GameStatus} */
    this.status = "ready";
    this.lives = MAX_LIVES;
    this.elapsed = 0;
    this.message = "按住下方「前進」準備開局";
    this.runners = makeRunners();
    /** @type {RefereeState} */
    this.refereeState = "away";
    this.countIndex = -1;
    this.phaseTimer = 0;
    this.checkHold = 1.6;
    this.countInterval = 0.82;
    this.gapMin = 0.35;
    this.gapMax = 0.75;
    this.nextGap = 0.5;
    /** @type {'idle'|'count'|'watch'|'gap'} */
    this.refPhase = "idle";
    this.playerHolding = false;
    this.best = loadBest();
    /** @type {string[]} */
    this.pendingEvents = [];
  }

  get player() {
    return this.runners[0];
  }

  reset() {
    this.status = "ready";
    this.lives = MAX_LIVES;
    this.elapsed = 0;
    this.message = "點「開局」開始";
    this.runners = makeRunners();
    this.refereeState = "away";
    this.countIndex = -1;
    this.phaseTimer = 0;
    this.refPhase = "idle";
    this.playerHolding = false;
    this.pendingEvents = [];
  }

  start() {
    this.status = "playing";
    this.lives = MAX_LIVES;
    this.elapsed = 0;
    this.runners = makeRunners();
    this.refereeState = "away";
    this.countIndex = -1;
    this.phaseTimer = 0;
    this.refPhase = "gap";
    this.nextGap = 0.6;
    this.playerHolding = false;
    this.message = "準備…";
    this.pendingEvents.push("start");
    return true;
  }

  setHold(on) {
    this.playerHolding = on;
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    this.pendingEvents = [];
    if (this.status !== "playing") return this.pendingEvents;

    this.elapsed += dt;
    for (const r of this.runners) {
      if (r.caughtFlash > 0) r.caughtFlash = Math.max(0, r.caughtFlash - dt);
    }

    this.tickReferee(dt);
    this.tickRunners(dt);
    this.checkFinish();
    return this.pendingEvents;
  }

  tickReferee(dt) {
    this.phaseTimer -= dt;

    if (this.refPhase === "gap") {
      this.refereeState = "away";
      this.countIndex = -1;
      if (this.phaseTimer <= 0) {
        this.refPhase = "count";
        this.countIndex = 0;
        this.phaseTimer = this.countInterval;
        this.refereeState = "away";
        this.message = COUNT_LABELS[0];
        this.pendingEvents.push("count", "count-0");
      } else if (this.phaseTimer > 0) {
        this.message = "背對…可以動！";
      }
      return;
    }

    if (this.refPhase === "count") {
      this.refereeState = "away";
      if (this.phaseTimer <= 0) {
        this.countIndex += 1;
        if (this.countIndex >= 3) {
          this.refPhase = "watch";
          this.refereeState = "watching";
          this.phaseTimer = this.checkHold;
          this.message = COUNT_LABELS[3];
          this.pendingEvents.push("turn", "wood");
        } else {
          this.phaseTimer = this.countInterval;
          this.message = COUNT_LABELS[this.countIndex];
          this.pendingEvents.push(`count-${this.countIndex}`);
        }
      }
      return;
    }

    if (this.refPhase === "watch") {
      this.refereeState = "watching";
      if (this.phaseTimer <= 0) {
        this.refPhase = "gap";
        this.nextGap = this.gapMin + Math.random() * (this.gapMax - this.gapMin);
        this.phaseTimer = this.nextGap;
        this.refereeState = "away";
        this.countIndex = -1;
        this.message = "背對…可以動！";
        this.pendingEvents.push("away");
      }
    }
  }

  tickRunners(dt) {
    const canMove = this.refereeState === "away" && this.refPhase !== "idle";

    for (const r of this.runners) {
      if (r.finished) {
        r.moving = false;
        continue;
      }

      let wantsMove = false;
      if (r.isPlayer) {
        wantsMove = this.playerHolding && this.status === "playing";
      } else {
        wantsMove = this.aiWantsMove(r, canMove);
      }

      if (this.refereeState === "watching" && wantsMove) {
        this.catchRunner(r);
        continue;
      }

      r.moving = wantsMove && canMove;
      if (r.moving) {
        const prev = r.progress;
        r.progress = Math.min(FINISH, r.progress + r.speed * dt);
        if (r.progress > prev) this.pendingEvents.push(r.isPlayer ? "step" : "ai-step");
      }
    }
  }

  /**
   * @param {Runner} r
   * @param {boolean} canMove
   */
  aiWantsMove(r, canMove) {
    if (!canMove || r.finished) return false;
    if (this.refPhase === "gap") return Math.random() < 0.85;
    if (this.refPhase === "count") {
      const urgency = r.progress < 0.35 ? 0.95 : 0.75;
      return Math.random() < urgency;
    }
    return false;
  }

  /**
   * @param {Runner} r
   */
  catchRunner(r) {
    r.moving = false;
    r.caughtFlash = 0.55;
    r.progress = 0;

    if (r.isPlayer) {
      this.lives -= 1;
      this.pendingEvents.push("caught");
      if (this.lives <= 0) {
        this.status = "lost";
        this.message = "生命用盡，再試一次！";
        this.pendingEvents.push("lose");
      } else {
        this.message = `被逮到了！剩 ${this.lives} 命`;
        this.pendingEvents.push("hurt");
        this.refPhase = "gap";
        this.phaseTimer = 1.1;
        this.refereeState = "away";
        this.countIndex = -1;
      }
    } else {
      this.pendingEvents.push("ai-caught");
    }
  }

  checkFinish() {
    for (const r of this.runners) {
      if (!r.finished && r.progress >= FINISH) {
        r.finished = true;
        r.finishTime = this.elapsed;
        r.progress = FINISH;
        r.moving = false;
        if (r.isPlayer) {
          this.status = "won";
          const t = this.elapsed;
          const prev = this.best.bestTime;
          const newBest =
            prev == null || t < prev ? t : prev;
          this.best = {
            wins: this.best.wins + 1,
            bestTime: newBest,
          };
          saveBest(this.best);
          this.message =
            prev == null || t <= prev
              ? `衝線！新紀錄 ${formatTime(t)}`
              : `衝線！${formatTime(t)}（最佳 ${formatTime(newBest)}）`;
          this.pendingEvents.push("win");
        } else if (this.status === "playing") {
          this.status = "lost";
          this.message = `${r.name} 先衝線了…`;
          this.pendingEvents.push("lose");
        }
      }
    }
  }

  /** @returns {number} */
  playerProgressPct() {
    return Math.round(this.player.progress * 100);
  }
}

/**
 * @param {number} sec
 */
export function formatTime(sec) {
  const s = Math.max(0, sec);
  if (s < 60) return `${s.toFixed(1)} 秒`;
  const m = Math.floor(s / 60);
  const r = (s % 60).toFixed(1);
  return `${m}:${r.padStart(4, "0")}`;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {StatueGame} game
 * @param {number} now
 */
export function drawGame(ctx, game, now) {
  drawSky(ctx);
  drawTrack(ctx);
  drawFinish(ctx);
  drawReferee(ctx, game, now);

  const laneX = [W * 0.28, W * 0.5, W * 0.72];
  for (const r of game.runners) {
    const x = laneX[r.lane] ?? W * 0.5;
    const y = trackY(r.progress);
    drawRunner(ctx, x, y, r, now);
  }

  if (game.status === "ready") drawOverlay(ctx, "點「開局」");
  else if (game.status === "won") drawOverlay(ctx, "你贏了！");
  else if (game.status === "lost") drawOverlay(ctx, "再來");
}

/** @type {{ light: Record<string, string>, dark: Record<string, string> }} */
const PALETTE = {
  light: {
    skyTop: "#7dd3fc",
    skyMid: "#bae6fd",
    skyBot: "#ecfccb",
    grass: "#86efac",
    lane: "#fef9c3",
    laneLine: "#fbbf24",
    border: "#ca8a04",
  },
  dark: {
    skyTop: "#0c4a6e",
    skyMid: "#075985",
    skyBot: "#14532d",
    grass: "#166534",
    lane: "#422006",
    laneLine: "#ca8a04",
    border: "#eab308",
  },
};

function activePalette() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? PALETTE.dark
    : PALETTE.light;
}

function drawSky(ctx) {
  const p = activePalette();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, p.skyTop);
  g.addColorStop(0.45, p.skyMid);
  g.addColorStop(1, p.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  puff(ctx, 60, 48, 36);
  puff(ctx, 180, 72, 28);
  puff(ctx, 340, 56, 32);
}

/**
 * @param {CanvasRenderingContext2D} c
 */
function puff(c, x, y, r) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.arc(x + r * 0.9, y + r * 0.15, r * 0.72, 0, Math.PI * 2);
  c.arc(x - r * 0.75, y + r * 0.2, r * 0.6, 0, Math.PI * 2);
  c.fill();
}

function drawTrack(ctx) {
  const p = activePalette();
  const left = W * 0.12;
  const right = W * 0.88;
  const top = 88;
  const bottom = H - 36;

  ctx.fillStyle = p.grass;
  ctx.fillRect(0, top - 20, W, bottom - top + 56);

  ctx.fillStyle = p.lane;
  roundRect(ctx, left, top, right - left, bottom - top, 18);
  ctx.fill();

  ctx.strokeStyle = p.laneLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 10]);
  const lanes = [W * 0.28, W * 0.5, W * 0.72];
  for (let i = 0; i < lanes.length - 1; i++) {
    const x = (lanes[i] + lanes[i + 1]) / 2;
    ctx.beginPath();
    ctx.moveTo(x, top + 8);
    ctx.lineTo(x, bottom - 8);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.strokeStyle = p.border;
  ctx.lineWidth = 4;
  roundRect(ctx, left, top, right - left, bottom - top, 18);
  ctx.stroke();
}

function drawFinish(ctx) {
  const y = trackY(1);
  const left = W * 0.12;
  const width = W * 0.76;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#111827" : "#f9fafb";
    ctx.fillRect(left + (width / 8) * i, y - 14, width / 8, 12);
  }
  ctx.fillStyle = "#dc2626";
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("終點", W / 2, y - 20);
}

/**
 * @param {number} progress 0..1
 */
function trackY(progress) {
  const top = 110;
  const bottom = H - 72;
  return bottom - progress * (bottom - top);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {StatueGame} game
 * @param {number} now
 */
function drawReferee(ctx, game, now) {
  const cx = W / 2;
  const cy = 52;
  const watching = game.refereeState === "watching";

  ctx.fillStyle = watching
    ? "rgba(220,38,38,0.18)"
    : "rgba(34,197,94,0.18)";
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  if (!watching) ctx.scale(-1, 1);

  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(0, -6, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = watching ? "#b91c1c" : "#15803d";
  roundRect(ctx, -16, 6, 32, 28, 8);
  ctx.fill();

  ctx.fillStyle = "#111827";
  if (watching) {
    ctx.beginPath();
    ctx.arc(-5, -8, 2.2, 0, Math.PI * 2);
    ctx.arc(5, -8, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -4, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    ctx.fillRect(-12, -4, 24, 6);
  }

  ctx.restore();

  if (watching) {
    ctx.strokeStyle = "rgba(220,38,38,0.55)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - 40, cy + 22);
    ctx.lineTo(cx - 90, H * 0.55);
    ctx.moveTo(cx + 40, cy + 22);
    ctx.lineTo(cx + 90, H * 0.55);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const pulse = 0.5 + 0.5 * Math.sin(now / 180);
  if (game.refPhase === "count" && game.countIndex >= 0 && game.countIndex < 3) {
    ctx.fillStyle = `rgba(34,197,94,${0.25 + pulse * 0.2})`;
    ctx.font = "800 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(COUNT_LABELS[game.countIndex], cx, cy + 52);
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {Runner} r
 * @param {number} now
 */
function drawRunner(ctx, x, y, r, now) {
  if (r.caughtFlash > 0) {
    ctx.fillStyle = `rgba(220,38,38,${r.caughtFlash * 0.45})`;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  const bob = r.moving ? Math.sin(now / 70) * 3 : 0;
  const ry = y + bob;

  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = r.color;
  roundRect(ctx, x - 12, ry - 8, 24, 26, 8);
  ctx.fill();

  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(x, ry - 14, 10, 0, Math.PI * 2);
  ctx.fill();

  if (r.moving) {
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 8, ry + 18);
    ctx.lineTo(x - 14 + Math.sin(now / 80) * 6, ry + 28);
    ctx.moveTo(x + 8, ry + 18);
    ctx.lineTo(x + 14 - Math.sin(now / 80) * 6, ry + 28);
    ctx.stroke();
  }

  if (r.finished) {
    ctx.font = "700 11px system-ui, sans-serif";
    ctx.fillStyle = "#15803d";
    ctx.textAlign = "center";
    ctx.fillText("✓", x, ry - 26);
  }

  ctx.font = "600 10px system-ui, sans-serif";
  ctx.fillStyle = "#374151";
  ctx.textAlign = "center";
  ctx.fillText(r.name, x, ry + 38);
}

/**
 * @param {CanvasRenderingContext2D} c
 */
function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} msg
 */
function drawOverlay(ctx, msg) {
  ctx.fillStyle = "rgba(15,23,42,0.42)";
  roundRect(ctx, 72, H / 2 - 34, W - 144, 68, 14);
  ctx.fill();
  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 20px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(msg, W / 2, H / 2);
}

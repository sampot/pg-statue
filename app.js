import { StatueAudio } from "./audio.js";
import {
  StatueGame,
  W,
  H,
  MAX_LIVES,
  drawGame,
  formatTime,
} from "./game.js";

const audio = new StatueAudio();
const game = new StatueGame();
globalThis.__statue = game;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const livesEl = document.getElementById("lives");
const progressEl = document.getElementById("progress");
const bestEl = document.getElementById("best");
const statusEl = document.getElementById("status");
const refereeBadge = document.getElementById("referee-badge");
const refereeLabel = document.getElementById("referee-label");
const btnStart = document.getElementById("btn-start");
const btnMute = document.getElementById("btn-mute");
const btnMove = document.getElementById("btn-move");

canvas.width = W;
canvas.height = H;

let lastTs = 0;
let running = true;
/** @type {Set<string>} */
const stepThrottle = new Set();

function setStatus(msg, tone = "") {
  statusEl.textContent = msg;
  statusEl.dataset.tone = tone;
}

function hearts(n) {
  const full = "♥".repeat(Math.max(0, n));
  const empty = "♡".repeat(Math.max(0, MAX_LIVES - n));
  return full + empty;
}

function syncBest() {
  const { wins, bestTime } = game.best;
  if (bestTime != null) {
    bestEl.textContent = `${formatTime(bestTime)} · ${wins} 勝`;
  } else if (wins > 0) {
    bestEl.textContent = `${wins} 勝`;
  } else {
    bestEl.textContent = "—";
  }
}

function syncHud() {
  livesEl.textContent = hearts(game.lives);
  progressEl.textContent = `${game.playerProgressPct()}%`;

  const refState = game.refereeState === "watching" ? "watch" : "away";
  refereeBadge.dataset.state = refState;
  refereeLabel.textContent = refState === "watch" ? "回頭" : "背對";

  const tone =
    game.status === "won" ? "win" : game.status === "lost" ? "lose" : "";
  setStatus(game.message, tone);

  if (game.status === "ready") {
    btnStart.textContent = "開局";
    btnStart.disabled = false;
    btnMove.disabled = true;
  } else if (game.status === "playing") {
    btnStart.textContent = "進行中";
    btnStart.disabled = true;
    btnMove.disabled = false;
  } else {
    btnStart.textContent = "再來一局";
    btnStart.disabled = false;
    btnMove.disabled = true;
    game.setHold(false);
    btnMove.classList.remove("is-active");
  }

  btnMute.textContent = audio.enabled ? "音效" : "靜音";
  btnMute.setAttribute("aria-pressed", audio.enabled ? "true" : "false");
}

/**
 * @param {string[]} events
 */
function handleEvents(events) {
  for (const e of events) {
    if (e === "start") audio.start();
    else if (e === "count-0") audio.count(0);
    else if (e === "count-1") audio.count(1);
    else if (e === "count-2") audio.count(2);
    else if (e === "wood") audio.wood();
    else if (e === "away") audio.away();
    else if (e === "step") {
      if (!stepThrottle.has("step")) {
        audio.step();
        stepThrottle.add("step");
        setTimeout(() => stepThrottle.delete("step"), 90);
      }
    } else if (e === "caught") audio.caught();
    else if (e === "hurt") audio.hurt();
    else if (e === "win") audio.win();
    else if (e === "lose") audio.lose();
  }
}

function bindHold(el) {
  const press = async () => {
    await audio.unlock();
    if (game.status !== "playing") return;
    game.setHold(true);
    el.classList.add("is-active");
  };
  const release = () => {
    game.setHold(false);
    el.classList.remove("is-active");
  };

  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    void press();
  });
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("lostpointercapture", release);

  el.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      void press();
    }
  });
  el.addEventListener("keyup", (e) => {
    if (e.key === " " || e.key === "Enter") release();
  });
}

async function tryStart() {
  await audio.unlock();
  if (game.status === "playing") return;
  game.start();
  syncHud();
}

btnStart.addEventListener("click", () => {
  void tryStart();
});

btnMute.addEventListener("click", async () => {
  await audio.unlock();
  audio.setEnabled(!audio.enabled);
  syncHud();
});

bindHold(btnMove);

function frame(ts) {
  if (!running) return;
  const dt = Math.min(0.05, (ts - lastTs) / 1000) || 0.016;
  lastTs = ts;

  const events = game.update(dt);
  if (events.length) handleEvents(events);

  drawGame(ctx, game, ts);
  syncHud();
  requestAnimationFrame(frame);
}

document.body.addEventListener(
  "pointerdown",
  () => {
    void audio.unlock();
  },
  { once: true },
);

syncBest();
syncHud();
drawGame(ctx, game, 0);
requestAnimationFrame((ts) => {
  lastTs = ts;
  requestAnimationFrame(frame);
});

const boardEl = document.querySelector("#board");
const toastEl = document.querySelector("#toast");
const feedEl = document.querySelector("#event-feed");
const boardSizeEl = document.querySelector("#board-size");
const moveCountEl = document.querySelector("#move-count");
const eventCountEl = document.querySelector("#event-count");
const eventHintEl = document.querySelector("#event-hint");
const humanScoreEl = document.querySelector("#human-score");
const botScoreEl = document.querySelector("#bot-score");
const humanCard = document.querySelector("#human-card");
const botCard = document.querySelector("#bot-card");
const humanTurn = document.querySelector("#human-turn");
const botTurn = document.querySelector("#bot-turn");
const roundLabel = document.querySelector("#round-label");

const EVENT_INTERVAL = 4;
let size = 3;
let board = new Map();
let currentPlayer = "X";
let moveCount = 0;
let movesUntilEvent = EVENT_INTERVAL;
let scores = { X: 0, O: 0 };
let gameOver = false;
let round = 1;
let toastTimer;
let shielded = false;
let powerups = { erase: 0, extend: 0, shield: 0 };
const powerupButtons = [...document.querySelectorAll(".powerup-button")];
const winRuleEl = document.querySelector("#win-rule");
const powerupHintEl = document.querySelector("#powerup-hint");

function key(row, col) { return `${row},${col}`; }
function getCell(row, col) { return board.get(key(row, col)); }
function setCell(row, col, value) { board.set(key(row, col), value); }
function randomFrom(items) { return items[Math.floor(Math.random() * items.length)]; }
function winLength() { return Math.min(5, Math.max(3, size - 1)); }

function renderBoard() {
  boardEl.style.setProperty("--board-size", size);
  boardEl.innerHTML = "";
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = document.createElement("button");
      const value = getCell(row, col);
      cell.className = `cell${value ? ` ${value.toLowerCase()}` : ""}`;
      cell.type = "button";
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", value ? `${value} mark at row ${row + 1}, column ${col + 1}` : `Empty space at row ${row + 1}, column ${col + 1}`);
      cell.disabled = Boolean(value) || gameOver || currentPlayer !== "X";
      cell.addEventListener("click", () => placeMark(row, col, "X"));
      boardEl.appendChild(cell);
    }
  }
  boardSizeEl.textContent = `${String(size).padStart(2, "0")} × ${String(size).padStart(2, "0")} FIELD`;
  moveCountEl.textContent = `MOVE ${String(moveCount).padStart(2, "0")}`;
  eventCountEl.textContent = String(movesUntilEvent).padStart(2, "0");
  winRuleEl.textContent = `${winLength()} CONNECTED = WIN`;
  powerupButtons.forEach((button) => {
    const amount = powerups[button.dataset.powerup];
    button.disabled = amount < 1 || currentPlayer !== "X" || gameOver;
    button.classList.toggle("ready", amount > 0 && currentPlayer === "X" && !gameOver);
    button.querySelector("b").textContent = amount;
  });
  powerupHintEl.textContent = shielded ? "Shield armed. Your next X cannot be erased." : "Earn one when the arena intervenes.";
  updateTurnUI();
}

function updateTurnUI() {
  const humanActive = currentPlayer === "X" && !gameOver;
  humanCard.classList.toggle("active", humanActive);
  botCard.classList.toggle("active", !humanActive && !gameOver);
  humanTurn.textContent = humanActive ? "YOUR TURN" : "ON DECK";
  botTurn.textContent = !humanActive && !gameOver ? "CALCULATING" : "ON DECK";
}

function addFeed(title, text, owner = "human") {
  const item = document.createElement("div");
  item.className = `feed-item ${owner}`;
  item.innerHTML = `<strong>${title}</strong>${text}`;
  feedEl.prepend(item);
  while (feedEl.children.length > 3) feedEl.lastElementChild.remove();
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3000);
}

function checkWin(row, col, player) {
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dr, dc] of directions) {
    const cells = [[row, col]];
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (getCell(r, c) === player) {
        cells.push([r, c]);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (cells.length >= winLength()) return cells;
  }
  return null;
}

function expandIfNeeded(row, col) {
  if (row > 0 && row < size - 1 && col > 0 && col < size - 1) return [row, col];
  const oldSize = size;
  size += randomFrom([2, 2, 4]);
  const shifted = new Map();
  board.forEach((value, cellKey) => {
    const [r, c] = cellKey.split(",").map(Number);
    shifted.set(key(r + 1, c + 1), value);
  });
  board = shifted;
  addFeed("FIELD EXPANDED", `${oldSize}×${oldSize} became ${size}×${size}. No edge is safe.`, "human");
  return [row + 1, col + 1];
}

function placeMark(row, col, player) {
  if (gameOver || getCell(row, col)) return;
  setCell(row, col, player);
  moveCount += 1;
  movesUntilEvent -= 1;
  const [actualRow, actualCol] = expandIfNeeded(row, col);
  const winningCells = checkWin(actualRow, actualCol, player);
  renderBoard();
  highlightLast(actualRow, actualCol);
  if (winningCells) {
    finishGame(player, winningCells);
    return;
  }
  if (movesUntilEvent === 0) {
    triggerIntervention(player);
    movesUntilEvent = randomFrom([3, 4, 5]);
  }
  currentPlayer = player === "X" ? "O" : "X";
  renderBoard();
  if (currentPlayer === "O") window.setTimeout(botMove, 450);
}

function highlightLast(row, col) {
  const cell = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  if (cell) cell.classList.add("last");
}

function finishGame(player, cells) {
  gameOver = true;
  scores[player] += 1;
  if (player === "X") humanScoreEl.textContent = scores.X;
  else botScoreEl.textContent = scores.O;
  cells.forEach(([row, col]) => {
    const cell = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (cell) cell.classList.add("win");
  });
  addFeed(player === "X" ? "YOU CONNECTED FIVE" : "ORACLE CONNECTED FIVE", player === "X" ? "The timeline bends to your will." : "Probability wins this timeline.", player === "X" ? "human" : "bot");
  showToast(player === "X" ? "You own this timeline. Reset to run it back." : "The Oracle got there first. Reset and disrupt the next timeline.");
  renderBoard();
}

function triggerIntervention(lastPlayer) {
  const events = ["eraseBot", "extendHuman", "shieldHuman", "eraseHuman", "extendBot", "glitch"];
  const event = randomFrom(events);
  if (event === "eraseBot") grantPowerup("erase", "VOID CHARGE", "The arena stored a void charge for you.");
  if (event === "extendHuman") grantPowerup("extend", "ECHO CHARGE", "The arena stored an echo charge for you.");
  if (event === "shieldHuman") {
    grantPowerup("shield", "SHIELD CHARGE", "The arena stored a shield charge for you.");
  }
  if (event === "eraseHuman" && !shielded) eraseMark("X", "THE VOID", "A random X blinked out. The timeline demands a sacrifice.");
  if (event === "eraseHuman" && shielded) {
    shielded = false;
    addFeed("SHIELD TRIGGERED", "Your shield absorbed the void.", "human");
    showToast("Your shield blocked the arena intervention.");
  }
  if (event === "extendBot") extendMark("O", "ORACLE ADVANTAGE", "The Oracle replicated a mark. The math is getting rude.", "bot");
  if (event === "glitch") {
    size += 2;
    addFeed("ORACLE GLITCH", "The board widened in the Oracle's favor.", "bot");
    showToast("Oracle glitch: the field just got bigger.");
  }

  function grantPowerup(type, title, text) {
    powerups[type] += 1;
    addFeed(title, text, "human");
    showToast(`${title}: use it from your powerup rack.`);
  }
  renderBoard();
}

function eraseMark(player, title, text) {
  const marks = [];
  board.forEach((value, cellKey) => { if (value === player) marks.push(cellKey); });
  if (!marks.length) {
    addFeed(title, "The void found nothing to erase.", player === "O" ? "human" : "bot");
    return;
  }
  const target = randomFrom(marks);
  if (player === "X" && shielded) {
    shielded = false;
    addFeed("SHIELD TRIGGERED", "Your shield absorbed the void.", "human");
    showToast("Your shield blocked the erase.");
    return;
  }
  board.delete(target);
  addFeed(title, text, player === "O" ? "human" : "bot");
  showToast(text);
}

function extendMark(player, title, text, owner = "human") {
  const marks = [];
  board.forEach((value, cellKey) => { if (value === player) marks.push(cellKey); });
  const source = marks.length ? randomFrom(marks).split(",").map(Number) : [Math.floor(size / 2), Math.floor(size / 2)];
  const offsets = [[1, 1], [1, 0], [0, 1], [-1, 1]];
  const [dr, dc] = randomFrom(offsets);
  const target = [source[0] + dr, source[1] + dc];
  if (target[0] >= 0 && target[0] < size && target[1] >= 0 && target[1] < size && !getCell(...target)) {
    setCell(...target, player);
    addFeed(title, text, owner);
    showToast(text);
  } else {
    addFeed(title, "The echo hit a occupied cell and fizzled.", owner);
  }
}

function botMove() {
  if (gameOver) return;
  const options = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) if (!getCell(row, col)) options.push([row, col]);
  }
  const winningMove = findTacticalMove("O");
  const blockingMove = findTacticalMove("X");
  const move = winningMove || blockingMove || chooseStrategicMove(options);
  placeMark(move[0], move[1], "O");
}

function findTacticalMove(player) {
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!getCell(row, col)) {
        setCell(row, col, player);
        const wins = checkWin(row, col, player);
        board.delete(key(row, col));
        if (wins) return [row, col];
      }
    }
  }
  return null;
}

function lineLength(row, col, player, rowStep, colStep) {
  let length = 1;
  for (const direction of [-1, 1]) {
    let r = row + rowStep * direction;
    let c = col + colStep * direction;
    while (getCell(r, c) === player) {
      length += 1;
      r += rowStep * direction;
      c += colStep * direction;
    }
  }
  return length;
}

function hasAdjacentMark(row, col, player) {
  for (let rowStep = -1; rowStep <= 1; rowStep += 1) {
    for (let colStep = -1; colStep <= 1; colStep += 1) {
      if ((rowStep || colStep) && getCell(row + rowStep, col + colStep) === player) return true;
    }
  }
  return false;
}

function countWinningThreats(player) {
  let threats = 0;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!getCell(row, col) && checkWin(row, col, player)) threats += 1;
    }
  }
  return threats;
}

function chooseStrategicMove(options) {
  const center = (size - 1) / 2;
  let bestScore = -Infinity;
  let bestMoves = [];
  options.forEach(([row, col]) => {
    setCell(row, col, "O");
    const offensiveLines = [
      lineLength(row, col, "O", 1, 0),
      lineLength(row, col, "O", 0, 1),
      lineLength(row, col, "O", 1, 1),
      lineLength(row, col, "O", 1, -1),
    ];
    const offensiveScore = Math.max(...offensiveLines) ** 3;
    const forkScore = countWinningThreats("O") * 95;
    board.delete(key(row, col));

    setCell(row, col, "X");
    const defensiveLines = [
      lineLength(row, col, "X", 1, 0),
      lineLength(row, col, "X", 0, 1),
      lineLength(row, col, "X", 1, 1),
      lineLength(row, col, "X", 1, -1),
    ];
    const defensiveScore = Math.max(...defensiveLines) ** 3;
    board.delete(key(row, col));

    const centerScore = Math.max(0, size - Math.abs(row - center) - Math.abs(col - center));
    const adjacencyScore = hasAdjacentMark(row, col, "O") ? 14 : 0;
    const score = offensiveScore * 1.4 + defensiveScore * 1.15 + forkScore + centerScore * 2 + adjacencyScore + Math.random() * 3;
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [[row, col]];
    } else if (score === bestScore) {
      bestMoves.push([row, col]);
    }
  });
  return randomFrom(bestMoves);
}

function resetGame() {
  size = 3; board = new Map(); currentPlayer = "X"; moveCount = 0; movesUntilEvent = EVENT_INTERVAL; gameOver = false; round += 1; shielded = false; powerups = { erase: 0, extend: 0, shield: 0 };
  roundLabel.textContent = `ROUND ${String(round).padStart(2, "0")}`;
  feedEl.innerHTML = "";
  addFeed("TIMELINE READY", "A fresh 3×3 field. Connect three to win.", "human");
  renderBoard();
}

document.querySelector("#reset-button").addEventListener("click", resetGame);
powerupButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const type = button.dataset.powerup;
    if (!powerups[type] || currentPlayer !== "X" || gameOver) return;
    powerups[type] -= 1;
    if (type === "erase") eraseMark("O", "VOID POWERUP", "You erased one Oracle mark.");
    if (type === "extend") extendMark("X", "ECHO POWERUP", "Your X echoed into a neighboring space.");
    if (type === "shield") {
      shielded = true;
      addFeed("SHIELD POWERUP", "Your next X is protected from erasure.", "human");
      showToast("Shield armed.");
    }
    renderBoard();
  });
});
addFeed("TIMELINE READY", "A fresh 3×3 field. Connect three to win.", "human");
renderBoard();

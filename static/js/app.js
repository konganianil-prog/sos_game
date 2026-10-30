(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const state = {
    mode: "single",
    size: 5,
    difficulty: "medium",
    board: [],
    owners: [],
    scores: [0, 0],
    current: 0,
    letter: "S",
    names: ["Player 1", "Player 2"],
    combinations: [],
    moveCount: 0,
    startedAt: 0,
    elapsedBeforePause: 0,
    timerId: null,
    aiPending: false,
    paused: false,
    finished: false,
    sound: localStorage.getItem("sos-sound") !== "off",
  };
  let toastTimer;
  let audioContext;

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
  }

  function playSound(frequency = 540, duration = 0.07) {
    if (!state.sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.055, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.warn("Sound playback is unavailable.", error);
    }
  }

  function navigate(page) {
    $$(".page").forEach((section) => section.classList.toggle("active", section.id === `${page}-page`));
    $$(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.page === page));
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (page === "history") loadHistory();
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  function drawDecorativeBoards() {
    const art = $("#art-board");
    const artLetters = ["S", "", "O", "S", "", "", "O", "", "S", "", "S", "", "", "", "O", "", "S", "O", "", "", "O", "", "S", "", "S"];
    artLetters.forEach((letter, index) => {
      const cell = document.createElement("div");
      cell.className = `art-cell${[2, 3, 8].includes(index) ? " art-highlight" : ""}`;
      cell.textContent = letter;
      cell.style.animationDelay = `${index * 0.018}s`;
      art.append(cell);
    });
    const mini = $("#mini-board");
    ["S", "O", "S", "", "", "S", "O", "", "O", "", "S", "", "", "", "", "S"].forEach((letter, index) => {
      const cell = document.createElement("div");
      cell.className = `mini-cell${[0, 1, 2].includes(index) ? " highlight" : ""}`;
      cell.textContent = letter;
      mini.append(cell);
    });
  }

  function setMode(mode) {
    state.mode = mode;
    $$(".mode-option").forEach((button) => button.classList.toggle("selected", button.dataset.mode === mode));
    $("#difficulty-control").style.opacity = mode === "single" ? "1" : ".4";
    $("#difficulty").disabled = mode !== "single";
    const savedPlayerTwo = localStorage.getItem("sos-player-two");
    $("#player-two-name").value = mode === "single"
      ? "Computer"
      : (!savedPlayerTwo || savedPlayerTwo === "Computer" ? "Player 2" : savedPlayerTwo);
    $("#player-one-name").value = localStorage.getItem("sos-player-one") || "Player 1";
  }

  function renderBoard(highlighted = state.combinations) {
    const element = $("#game-board");
    element.style.setProperty("--board-size", state.size);
    element.style.gridTemplateColumns = `repeat(${state.size}, minmax(0, 1fr))`;
    element.innerHTML = "";
    const highlightedCells = new Set(highlighted.flat().map(([r, c]) => `${r},${c}`));
    const arrowsByCell = new Map();
    const arrowDirections = {
      "0,1": ["→", "right"],
      "1,0": ["↓", "down"],
      "1,1": ["↘", "down-right"],
      "1,-1": ["↙", "down-left"],
    };
    highlighted.forEach((combination) => {
      const [start, , end] = combination;
      const deltaRow = Math.sign(end[0] - start[0]);
      const deltaCol = Math.sign(end[1] - start[1]);
      const direction = arrowDirections[`${deltaRow},${deltaCol}`];
      if (!direction) return;
      const centerKey = `${combination[1][0]},${combination[1][1]}`;
      if (!arrowsByCell.has(centerKey)) arrowsByCell.set(centerKey, new Set());
      arrowsByCell.get(centerKey).add(direction[0]);
    });
    state.board.forEach((line, row) => line.forEach((letter, col) => {
      const cell = document.createElement("button");
      cell.type = "button";
      const ownerClass = letter ? ` owner-player-${state.owners[row][col] + 1}` : "";
      cell.className = `game-cell${letter ? ` letter-${letter.toLowerCase()}` : ""}${ownerClass}${highlightedCells.has(`${row},${col}`) ? " sos-cell" : ""}`;
      cell.textContent = letter || "";
      const arrows = arrowsByCell.get(`${row},${col}`);
      if (arrows) {
        const arrowMark = document.createElement("span");
        arrowMark.className = "sos-arrow-mark";
        arrowMark.setAttribute("aria-hidden", "true");
        arrowMark.textContent = [...arrows].join("");
        cell.append(arrowMark);
        const directionLabels = [...arrows].map((arrow) => ({
          "→": "right",
          "↓": "down",
          "↘": "down-right",
          "↙": "down-left",
        }[arrow]));
        cell.setAttribute(
          "aria-label",
          `${letter}, row ${row + 1}, column ${col + 1}, SOS arrow ${directionLabels.join(" and ")}`,
        );
      }
      cell.disabled = Boolean(letter) || state.paused || state.finished || state.aiPending || (state.mode === "single" && state.current === 1);
      cell.setAttribute("role", "gridcell");
      if (!arrows) {
        cell.setAttribute("aria-label", letter ? `${letter}, row ${row + 1}, column ${col + 1}` : `Empty, row ${row + 1}, column ${col + 1}`);
      }
      cell.addEventListener("click", () => placeHumanMove(row, col));
      element.append(cell);
    }));
    updateTurn();
  }

  function updateTurn() {
    $("#score-one").textContent = state.scores[0];
    $("#score-two").textContent = state.scores[1];
    $("#combination-count").textContent = state.combinations.length;
    $("#score-name-one").textContent = state.names[0];
    $("#score-name-two").textContent = state.names[1];
    $("#score-role-one").textContent = "PLAYER 1";
    $("#score-role-two").textContent = state.mode === "single" ? state.difficulty.toUpperCase() : "PLAYER 2";
    $(".player-one-card").classList.toggle("active-player", state.current === 0 && !state.finished);
    $(".player-two-card").classList.toggle("active-player", state.current === 1 && !state.finished);
    const name = state.names[state.current];
    $("#turn-message").textContent = state.aiPending ? `${name} is thinking…` : `${name}’s turn`;
  }

  function updateTimer() {
    const elapsed = state.elapsedBeforePause + Math.floor((Date.now() - state.startedAt) / 1000);
    $("#game-timer").textContent = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  }

  async function startGame() {
    state.size = Number($(".size-option.selected").dataset.size);
    state.mode = $(".mode-option.selected").dataset.mode;
    state.difficulty = $("#difficulty").value;
    state.names = [
      $("#player-one-name").value.trim() || "Player 1",
      state.mode === "single" ? "Computer" : ($("#player-two-name").value.trim() || "Player 2"),
    ];
    localStorage.setItem("sos-player-one", state.names[0]);
    if (state.mode === "two") localStorage.setItem("sos-player-two", state.names[1]);
    try {
      const result = await api(`/api/board/${state.size}`);
      state.board = result.board;
      state.owners = Array.from({ length: state.size }, () => Array(state.size).fill(null));
      state.scores = [0, 0];
      state.current = 0;
      state.letter = "S";
      state.combinations = [];
      state.moveCount = 0;
      state.paused = false;
      state.finished = false;
      state.aiPending = false;
      state.elapsedBeforePause = 0;
      state.startedAt = Date.now();
      clearInterval(state.timerId);
      state.timerId = setInterval(updateTimer, 1000);
      $$(".letter-button").forEach((button) => button.classList.toggle("selected", button.dataset.letter === "S"));
      $("#pause-overlay").classList.add("hidden");
      $("#pause-game").textContent = "Ⅱ Pause";
      renderBoard();
      navigate("game");
    } catch (error) {
      showToast(error.message);
    }
  }

  function announceCombos(combinations, player) {
    if (!combinations.length) return;
    state.scores[player] += combinations.length;
    state.combinations.push(...combinations);
    playSound(720, 0.18);
    showToast(`${combinations.length} SOS ${combinations.length === 1 ? "pattern" : "patterns"}! ${state.names[player]} score${state.names[player].endsWith("s") ? "" : "s"}.`);
  }

  async function placeHumanMove(row, col) {
    if (state.paused || state.finished || state.aiPending || state.board[row][col]) return;
    try {
      const result = await api("/api/move", {
        method: "POST",
        body: JSON.stringify({ board: state.board, row, col, letter: state.letter }),
      });
      state.board = result.board;
      state.owners[row][col] = state.current;
      state.moveCount++;
      playSound(state.letter === "S" ? 440 : 500);
      announceCombos(result.combinations, state.current);
      renderBoard(state.combinations);
      if (await checkGameOver()) return;
      if (result.combinations.length) return;
      state.current = state.mode === "single" ? 1 - state.current : 1 - state.current;
      renderBoard();
      if (state.mode === "single" && state.current === 1) queueAiMove();
    } catch (error) {
      showToast(error.message);
    }
  }

  function queueAiMove() {
    if (state.finished || state.paused || state.current !== 1) return;
    state.aiPending = true;
    renderBoard();
    window.setTimeout(async () => {
      if (state.paused || state.finished || state.current !== 1) {
        state.aiPending = false;
        renderBoard();
        return;
      }
      try {
        const result = await api("/api/ai-move", {
          method: "POST",
          body: JSON.stringify({ board: state.board, difficulty: state.difficulty }),
        });
        state.board = result.board;
        state.owners[result.row][result.col] = 1;
        state.moveCount++;
        announceCombos(result.combinations, 1);
        state.aiPending = false;
        renderBoard(state.combinations);
        if (await checkGameOver()) return;
        if (!result.combinations.length) state.current = 0;
        renderBoard();
        if (result.combinations.length) queueAiMove();
      } catch (error) {
        state.aiPending = false;
        renderBoard();
        showToast(error.message);
      }
    }, 550);
  }

  async function checkGameOver() {
    if (state.moveCount < state.size * state.size) return false;
    state.finished = true;
    clearInterval(state.timerId);
    renderBoard();
    let winner;
    if (state.scores[0] === state.scores[1]) winner = "Draw";
    else winner = state.names[state.scores[0] > state.scores[1] ? 0 : 1];
    try {
      await api("/api/games", {
        method: "POST",
        body: JSON.stringify({
          player_one: state.names[0],
          player_two: state.names[1],
          mode: state.mode,
          board_size: state.size,
          score_one: state.scores[0],
          score_two: state.scores[1],
          winner,
        }),
      });
    } catch (error) {
      showToast(`Match ended, but history could not be saved: ${error.message}`);
    }
    $("#modal-title").textContent = winner === "Draw" ? "A perfect draw." : `${winner} wins!`;
    $("#modal-result").textContent = winner === "Draw" ? "Dead even. Ready for a rematch?" : "Well played. What a match.";
    $("#modal-name-one").textContent = state.names[0];
    $("#modal-name-two").textContent = state.names[1];
    $("#modal-score-one").textContent = state.scores[0];
    $("#modal-score-two").textContent = state.scores[1];
    $("#gameover-modal").classList.remove("hidden");
    if (winner !== "Draw") launchConfetti();
    playSound(winner === "Draw" ? 400 : 800, 0.28);
    return true;
  }

  function launchConfetti() {
    const colors = ["#6ee7f5", "#a889ff", "#ff729b", "#73e8b3", "#ffd47d"];
    for (let i = 0; i < 48; i++) {
      const piece = document.createElement("i");
      piece.className = "confetti";
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.8}s`;
      piece.style.transform = `rotate(${Math.random() * 180}deg)`;
      document.body.append(piece);
      setTimeout(() => piece.remove(), 3500);
    }
  }

  function togglePause() {
    if (state.finished) return;
    state.paused = !state.paused;
    if (state.paused) {
      state.elapsedBeforePause += Math.floor((Date.now() - state.startedAt) / 1000);
      clearInterval(state.timerId);
      $("#pause-game").textContent = "▶ Resume";
      $("#pause-overlay").classList.remove("hidden");
    } else {
      state.startedAt = Date.now();
      state.timerId = setInterval(updateTimer, 1000);
      $("#pause-game").textContent = "Ⅱ Pause";
      $("#pause-overlay").classList.add("hidden");
    }
    renderBoard();
    if (!state.paused && state.mode === "single" && state.current === 1 && !state.aiPending) {
      queueAiMove();
    }
  }

  async function loadHistory() {
    const body = $("#history-body");
    body.innerHTML = '<tr><td colspan="6" class="empty-history">Loading your matches…</td></tr>';
    try {
      const result = await api("/api/history");
      $("#history-count").textContent = `${result.games.length} ${result.games.length === 1 ? "match" : "matches"} played`;
      if (!result.games.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty-history">No matches yet. Your first game is waiting.</td></tr>';
        return;
      }
      body.innerHTML = "";
      result.games.forEach((game) => {
        const row = document.createElement("tr");
        const date = new Date(`${game.played_at.replace(" ", "T")}`);
        const cells = [
          `<td>${escapeHtml(game.player_one)} <small>vs. ${escapeHtml(game.player_two)}</small></td>`,
          `<td>${game.mode === "single" ? "Solo" : "Two players"}</td>`,
          `<td>${game.board_size} × ${game.board_size}</td>`,
          `<td>${game.score_one} — ${game.score_two}</td>`,
          `<td class="${game.winner === "Draw" ? "" : "winner"}">${escapeHtml(game.winner)}</td>`,
          `<td>${Number.isNaN(date.getTime()) ? escapeHtml(game.played_at) : date.toLocaleDateString()}</td>`,
        ];
        row.innerHTML = cells.join("");
        body.append(row);
      });
    } catch (error) {
      body.innerHTML = `<tr><td colspan="6" class="empty-history">${escapeHtml(error.message)} <button class="text-button" id="retry-history">Try again</button></td></tr>`;
      $("#retry-history").addEventListener("click", loadHistory);
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  function setSound(enabled) {
    state.sound = enabled;
    localStorage.setItem("sos-sound", enabled ? "on" : "off");
    $("#sound-state").textContent = enabled ? "ON" : "OFF";
    $("#sound-toggle").style.color = enabled ? "var(--cyan)" : "";
  }

  $("#start-game").addEventListener("click", () => {
    $("#setup-panel").scrollIntoView({ behavior: "smooth", block: "center" });
    $("#setup-panel").classList.add("setup-emphasis");
    setTimeout(() => $("#setup-panel").classList.remove("setup-emphasis"), 850);
  });
  $("#launch-game").addEventListener("click", startGame);
  $$(".mode-option").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
  $$(".size-option").forEach((button) => button.addEventListener("click", () => {
    $$(".size-option").forEach((item) => item.classList.toggle("selected", item === button));
  }));
  $$(".letter-button").forEach((button) => button.addEventListener("click", () => {
    state.letter = button.dataset.letter;
    $$(".letter-button").forEach((item) => item.classList.toggle("selected", item === button));
    playSound(button.dataset.letter === "S" ? 440 : 500);
  }));
  $$(".nav-link,[data-page]").forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    navigate(button.dataset.page);
  }));
  $("#back-home").addEventListener("click", () => {
    if (!state.finished && state.moveCount > 0 && !window.confirm("Leave this match? It will not be saved to history.")) return;
    clearInterval(state.timerId);
    navigate("home");
  });
  $("#restart-game").addEventListener("click", () => {
    if (state.moveCount > 0 && !window.confirm("Restart this match? Its current score will be lost.")) return;
    startGame();
  });
  $("#pause-game").addEventListener("click", togglePause);
  $("#resume-game").addEventListener("click", togglePause);
  $("#sound-toggle").addEventListener("click", () => setSound(!state.sound));
  $("#sound-toggle-game").addEventListener("click", () => setSound(!state.sound));
  $("#refresh-history").addEventListener("click", loadHistory);
  $("#modal-home").addEventListener("click", () => {
    $("#gameover-modal").classList.add("hidden");
    navigate("home");
  });
  $("#play-again").addEventListener("click", () => {
    $("#gameover-modal").classList.add("hidden");
    startGame();
  });
  $("#player-one-name").value = localStorage.getItem("sos-player-one") || "Player 1";
  setMode("single");
  setSound(state.sound);
  drawDecorativeBoards();
})();

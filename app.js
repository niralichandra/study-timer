(() => {
  "use strict";

  const STORAGE_KEY = "study-timer-v1";
  const CIRCUMFERENCE = 2 * Math.PI * 100;

  const defaultState = {
    settings: {
      focus: 25,
      short: 5,
      long: 15,
      longEvery: 4,
      dailyGoal: 8,
      autoStart: false,
      sound: true,
      notify: false,
    },
    tasks: [],
    selectedTaskId: null,
    history: {}, // { "YYYY-MM-DD": { sessions, minutes } }
    completedFocus: 0,
    theme: "light",
  };

  const $ = (sel) => document.querySelector(sel);

  const els = {
    time: $("#time"),
    ring: $("#ringProgress"),
    startBtn: $("#startBtn"),
    resetBtn: $("#resetBtn"),
    skipBtn: $("#skipBtn"),
    modeBtns: document.querySelectorAll(".mode-btn"),
    sessionInfo: $("#sessionInfo"),
    currentTask: $("#currentTask"),
    taskForm: $("#taskForm"),
    taskInput: $("#taskInput"),
    taskEst: $("#taskEst"),
    taskList: $("#taskList"),
    emptyTasks: $("#emptyTasks"),
    clearDoneBtn: $("#clearDoneBtn"),
    statSessions: $("#statSessions"),
    statMinutes: $("#statMinutes"),
    statStreak: $("#statStreak"),
    goalText: $("#goalText"),
    goalFill: $("#goalFill"),
    weekChart: $("#weekChart"),
    resetStatsBtn: $("#resetStatsBtn"),
    settingsBtn: $("#settingsBtn"),
    settingsDialog: $("#settingsDialog"),
    settingsForm: $("#settingsForm"),
    themeToggle: $("#themeToggle"),
  };

  let state = load();
  let mode = "focus";
  let remaining = state.settings.focus * 60;
  let total = remaining;
  let running = false;
  let endAt = null;
  let tickId = null;

  // ---------- Persistence ----------
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) {
        return {
          ...defaultState,
          ...saved,
          settings: { ...defaultState.settings, ...saved.settings },
        };
      }
    } catch (_) { /* ignore corrupt storage */ }
    return structuredClone(defaultState);
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) { /* storage unavailable */ }
  }

  // ---------- Helpers ----------
  function dateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function modeLabel(m) {
    return { focus: "Focus", short: "Short Break", long: "Long Break" }[m];
  }

  // ---------- Timer ----------
  function setMode(newMode) {
    stop();
    mode = newMode;
    document.body.dataset.mode = mode;
    els.modeBtns.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    total = state.settings[mode] * 60;
    remaining = total;
    renderTimer();
  }

  function start() {
    if (running) return;
    running = true;
    endAt = Date.now() + remaining * 1000;
    els.startBtn.textContent = "Pause";
    tickId = setInterval(tick, 250);
    if (state.settings.notify && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  function stop() {
    running = false;
    clearInterval(tickId);
    tickId = null;
    els.startBtn.textContent = "Start";
  }

  function tick() {
    const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    if (left !== remaining) {
      remaining = left;
      renderTimer();
    }
    if (left <= 0) complete();
  }

  function reset() {
    stop();
    remaining = total;
    renderTimer();
  }

  function complete(skipped = false) {
    stop();

    if (mode === "focus" && !skipped) {
      recordFocus(state.settings.focus);
    }

    if (!skipped) alertDone();

    let next;
    if (mode === "focus") {
      const count = state.completedFocus;
      next = count > 0 && count % state.settings.longEvery === 0 ? "long" : "short";
    } else {
      next = "focus";
    }
    setMode(next);
    if (state.settings.autoStart && !skipped) start();
  }

  function recordFocus(minutes) {
    const key = dateKey();
    const day = state.history[key] || { sessions: 0, minutes: 0 };
    day.sessions += 1;
    day.minutes += minutes;
    state.history[key] = day;
    state.completedFocus += 1;

    const task = state.tasks.find((t) => t.id === state.selectedTaskId);
    if (task) task.done_sessions += 1;

    save();
    renderTasks();
    renderStats();
  }

  // ---------- Alerts ----------
  function alertDone() {
    const msg = mode === "focus" ? "Focus session done! Time for a break." : "Break's over. Back to studying!";
    if (state.settings.sound) beep();
    if (state.settings.notify && "Notification" in window && Notification.permission === "granted") {
      new Notification("Study Timer", { body: msg });
    }
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.25, 0.5].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.22);
      });
      setTimeout(() => ctx.close(), 1200);
    } catch (_) { /* audio unsupported */ }
  }

  // ---------- Rendering ----------
  function renderTimer() {
    const text = formatTime(remaining);
    els.time.textContent = text;
    document.title = `${text} · ${modeLabel(mode)}`;
    const progress = total ? 1 - remaining / total : 0;
    els.ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
    els.sessionInfo.textContent =
      mode === "focus"
        ? `Session #${state.completedFocus + 1}`
        : `${modeLabel(mode)} · ${state.completedFocus} done`;
  }

  function renderTasks() {
    els.taskList.innerHTML = "";
    state.tasks.forEach((task) => {
      const li = document.createElement("li");
      li.className = "task";
      li.classList.toggle("selected", task.id === state.selectedTaskId);
      li.classList.toggle("done", task.done);

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = task.done;
      cb.addEventListener("click", (e) => e.stopPropagation());
      cb.addEventListener("change", () => {
        task.done = cb.checked;
        save();
        renderTasks();
      });

      const title = document.createElement("span");
      title.className = "task-title";
      title.textContent = task.title;

      const count = document.createElement("span");
      count.className = "task-count";
      count.textContent = `${task.done_sessions}/${task.estimate}`;

      const del = document.createElement("button");
      del.className = "task-del";
      del.textContent = "×";
      del.title = "Delete task";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        state.tasks = state.tasks.filter((t) => t.id !== task.id);
        if (state.selectedTaskId === task.id) state.selectedTaskId = null;
        save();
        renderTasks();
      });

      li.addEventListener("click", () => {
        state.selectedTaskId = state.selectedTaskId === task.id ? null : task.id;
        save();
        renderTasks();
      });

      li.append(cb, title, count, del);
      els.taskList.appendChild(li);
    });

    els.emptyTasks.hidden = state.tasks.length > 0;
    const selected = state.tasks.find((t) => t.id === state.selectedTaskId);
    els.currentTask.textContent = selected ? selected.title : "Pick a task to focus on";
  }

  function streak() {
    let count = 0;
    const d = new Date();
    if (!state.history[dateKey(d)]) d.setDate(d.getDate() - 1);
    while (state.history[dateKey(d)]?.sessions > 0) {
      count += 1;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  function renderStats() {
    const today = state.history[dateKey()] || { sessions: 0, minutes: 0 };
    els.statSessions.textContent = today.sessions;
    els.statMinutes.textContent = today.minutes;
    els.statStreak.textContent = streak();

    const goal = state.settings.dailyGoal;
    els.goalText.textContent = `${today.sessions} / ${goal} sessions`;
    els.goalFill.style.width = `${Math.min(100, (today.sessions / goal) * 100)}%`;

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ d, minutes: state.history[dateKey(d)]?.minutes || 0, today: i === 0 });
    }
    const max = Math.max(60, ...days.map((x) => x.minutes));
    els.weekChart.innerHTML = "";
    days.forEach(({ d, minutes, today: isToday }) => {
      const col = document.createElement("div");
      col.className = "bar-col" + (isToday ? " today" : "");
      col.title = `${minutes} min`;
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = `${(minutes / max) * 80}%`;
      const label = document.createElement("span");
      label.className = "bar-label";
      label.textContent = d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
      col.append(bar, label);
      els.weekChart.appendChild(col);
    });
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    els.themeToggle.textContent = state.theme === "dark" ? "☀️" : "🌙";
  }

  // ---------- Settings ----------
  function openSettings() {
    const f = els.settingsForm.elements;
    for (const [key, value] of Object.entries(state.settings)) {
      if (!f[key]) continue;
      if (f[key].type === "checkbox") f[key].checked = value;
      else f[key].value = value;
    }
    els.settingsDialog.showModal();
  }

  function saveSettings() {
    const f = els.settingsForm.elements;
    const num = (name, fallback) => {
      const v = parseInt(f[name].value, 10);
      return Number.isFinite(v) && v > 0 ? v : fallback;
    };
    const s = state.settings;
    s.focus = num("focus", s.focus);
    s.short = num("short", s.short);
    s.long = num("long", s.long);
    s.longEvery = num("longEvery", s.longEvery);
    s.dailyGoal = num("dailyGoal", s.dailyGoal);
    s.autoStart = f.autoStart.checked;
    s.sound = f.sound.checked;
    s.notify = f.notify.checked;
    if (s.notify && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    save();
    if (!running) setMode(mode);
    renderStats();
  }

  // ---------- Events ----------
  els.startBtn.addEventListener("click", () => (running ? stop() : start()));
  els.resetBtn.addEventListener("click", reset);
  els.skipBtn.addEventListener("click", () => complete(true));

  els.modeBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      if (running && !confirm("The timer is running. Switch mode anyway?")) return;
      setMode(btn.dataset.mode);
    })
  );

  els.taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = els.taskInput.value.trim();
    if (!title) return;
    const task = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title,
      estimate: Math.max(1, parseInt(els.taskEst.value, 10) || 1),
      done_sessions: 0,
      done: false,
    };
    state.tasks.push(task);
    if (!state.selectedTaskId) state.selectedTaskId = task.id;
    els.taskInput.value = "";
    els.taskEst.value = 1;
    save();
    renderTasks();
  });

  els.clearDoneBtn.addEventListener("click", () => {
    state.tasks = state.tasks.filter((t) => !t.done);
    if (!state.tasks.some((t) => t.id === state.selectedTaskId)) state.selectedTaskId = null;
    save();
    renderTasks();
  });

  els.resetStatsBtn.addEventListener("click", () => {
    if (!confirm("Clear all study history?")) return;
    state.history = {};
    state.completedFocus = 0;
    save();
    renderStats();
    renderTimer();
  });

  els.settingsBtn.addEventListener("click", openSettings);
  els.settingsDialog.addEventListener("close", () => {
    if (els.settingsDialog.returnValue === "save") saveSettings();
  });

  els.themeToggle.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    save();
    applyTheme();
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea") || els.settingsDialog.open) return;
    if (e.code === "Space") {
      e.preventDefault();
      running ? stop() : start();
    } else if (e.key === "r" || e.key === "R") {
      reset();
    } else if (e.key === "s" || e.key === "S") {
      complete(true);
    }
  });

  // ---------- Init ----------
  els.ring.style.strokeDasharray = CIRCUMFERENCE;
  applyTheme();
  setMode("focus");
  renderTasks();
  renderStats();
})();

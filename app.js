'use strict';

/* ─────────────────────────────────────────────────────────────────────────
   Workout data for all four weeks
   ───────────────────────────────────────────────────────────────────────── */
const WEEKS = {
  1: {
    title: 'Week 1 — Learn & Activate',
    subtitle: 'Form First',
    goal: 'Wake up muscles + fix posture awareness',
    focus: 'Slow, controlled, perfect posture',
    exercises: [
      { name: 'Chin Tucks',       detail: '10 reps (3 sec hold)' },
      { name: 'Wall Angels',      detail: '10 reps' },
      { name: 'Band Pull-Aparts', detail: '15 reps' },
      { name: 'Band Face Pulls',  detail: '12 reps' },
      { name: 'Push-Ups',         detail: '8–10 reps' },
      { name: 'Band Chest Press', detail: '12 reps' },
      { name: 'Stretching',       detail: '1 min total' },
    ],
  },
  2: {
    title: 'Week 2 — Build Control',
    subtitle: '',
    goal: 'Better muscle engagement',
    focus: 'Add a 1-second squeeze on every pull-apart + face pull',
    exercises: [
      { name: 'Chin Tucks',       detail: '12 reps' },
      { name: 'Wall Angels',      detail: '12 reps' },
      { name: 'Band Pull-Aparts', detail: '20 reps' },
      { name: 'Band Face Pulls',  detail: '15 reps' },
      { name: 'Push-Ups',         detail: '10–12 reps' },
      { name: 'Band Chest Press', detail: '15 reps' },
      { name: 'Stretching',       detail: '1 min' },
    ],
  },
  3: {
    title: 'Week 3 — Add Intensity',
    subtitle: '',
    goal: 'Start reshaping posture + chest',
    focus: '2-second hold at end of each pull-apart · Slow push-ups (3 sec down)',
    exercises: [
      { name: 'Chin Tucks',       detail: '15 reps' },
      { name: 'Wall Angels',      detail: '12 slow reps' },
      { name: 'Band Pull-Aparts', detail: '20 reps (slower)' },
      { name: 'Band Face Pulls',  detail: '15 reps' },
      { name: 'Push-Ups',         detail: '12–15 reps' },
      { name: 'Band Chest Press', detail: '15–20 reps' },
    ],
  },
  4: {
    title: 'Week 4 — Challenge & Define',
    subtitle: '',
    goal: 'Visible improvement',
    focus: 'Push-ups + chest press back-to-back (mini burnout)',
    exercises: [
      { name: 'Chin Tucks',       detail: '15 reps' },
      { name: 'Wall Angels',      detail: '15 reps' },
      { name: 'Band Pull-Aparts', detail: '25 reps' },
      { name: 'Band Face Pulls',  detail: '15–20 reps' },
      { name: 'Push-Ups',         detail: '15+ reps (or to near failure)' },
      { name: 'Band Chest Press', detail: '20 reps' },
    ],
  },
};

/* ─────────────────────────────────────────────────────────────────────────
   State — persisted in localStorage
   ───────────────────────────────────────────────────────────────────────── */
const STORAGE_KEY = 'workoutTracker_v1';

const DEFAULT_STATE = {
  currentWeek: 1,          // 1-4
  daysAtLevel: 0,          // completed days at the current week level
  completedDays: [],       // array of 'YYYY-MM-DD' strings
  lastCompletedDate: null, // 'YYYY-MM-DD' or null
  todayDate: null,         // date string for the current session's "today"
  todayChecks: {},         // { exerciseName: true }  – reset each new day
  pendingNotification: null,
};

let state;
let calYear, calMonth;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return Object.assign({}, DEFAULT_STATE, JSON.parse(raw));
  } catch (_) { /* ignore corrupt data */ }
  return Object.assign({}, DEFAULT_STATE);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ─────────────────────────────────────────────────────────────────────────
   Date helpers
   ───────────────────────────────────────────────────────────────────────── */
function pad(n) { return String(n).padStart(2, '0'); }

function dateToStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayStr() { return dateToStr(new Date()); }

/** Days from date string a to date string b (positive = b is later) */
function daysBetween(a, b) {
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  return Math.round((parse(b) - parse(a)) / 86_400_000);
}

/* ─────────────────────────────────────────────────────────────────────────
   Current streak (consecutive days ending today or yesterday)
   ───────────────────────────────────────────────────────────────────────── */
function getCurrentStreak() {
  const done = new Set(state.completedDays);
  const today = todayStr();
  let streak = 0;
  let d = new Date();

  // Start from today if completed, otherwise yesterday
  if (!done.has(today)) d.setDate(d.getDate() - 1);

  while (true) {
    const s = dateToStr(d);
    if (done.has(s)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/* ─────────────────────────────────────────────────────────────────────────
   App initialisation
   ───────────────────────────────────────────────────────────────────────── */
function init() {
  state = loadState();
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();

  const today = todayStr();

  // ── New day: reset today's checks and check for streak break ──
  if (state.todayDate !== today) {
    // Check for streak break BEFORE wiping todayChecks
    if (state.lastCompletedDate) {
      const gap = daysBetween(state.lastCompletedDate, today);
      if (gap >= 7 && state.currentWeek > 1) {
        const fromWeek = state.currentWeek;
        state.currentWeek  = Math.max(1, state.currentWeek - 1);
        state.daysAtLevel  = 0;
        state.pendingNotification = {
          text: `You missed ${gap} days in a row. Dropped back to Week ${state.currentWeek} — let's get back at it!`,
        };
      }
    }
    state.todayDate   = today;
    state.todayChecks = {};
    saveState();
  }

  bindEvents();
  renderWorkout();
  renderCalendar();

  // Show drop-level notification if one is queued
  if (state.pendingNotification) {
    showNotification(state.pendingNotification.text);
    state.pendingNotification = null;
    saveState();
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   Event wiring
   ───────────────────────────────────────────────────────────────────────── */
function bindEvents() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Calendar navigation
  document.getElementById('prev-month').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });

  // Dismiss congrats overlay
  document.getElementById('dismiss-btn').addEventListener('click', dismissCongrats);
  document.getElementById('congrats-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) dismissCongrats();
  });

  // Dismiss notification
  document.getElementById('notif-close').addEventListener('click', () => {
    document.getElementById('notification').classList.remove('visible');
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('workout-view').hidden  = (tab !== 'workout');
  document.getElementById('calendar-view').hidden = (tab !== 'calendar');
  if (tab === 'calendar') renderCalendar();
}

function dismissCongrats() {
  document.getElementById('congrats-overlay').classList.remove('visible');
}

/* ─────────────────────────────────────────────────────────────────────────
   Workout view rendering
   ───────────────────────────────────────────────────────────────────────── */
function renderWorkout() {
  const today     = todayStr();
  const week      = WEEKS[state.currentWeek];
  const alreadyDone = state.completedDays.includes(today);

  // ── Week header ──
  const badge = document.getElementById('week-badge');
  badge.textContent = `WEEK ${state.currentWeek}`;
  badge.className = `week-badge w${state.currentWeek}`;

  document.getElementById('week-title').textContent = week.title;
  document.getElementById('week-goal').textContent  = week.goal;
  document.getElementById('week-focus').textContent = week.focus;

  // ── Progress bar ──
  const pct = Math.min((state.daysAtLevel / 7) * 100, 100);
  document.getElementById('days-count').textContent    = `${state.daysAtLevel} / 7 days`;
  document.getElementById('progress-fill').style.width = `${pct}%`;

  // ── Done-today banner ──
  document.getElementById('done-today').hidden = !alreadyDone;

  // ── Exercise list ──
  const list = document.getElementById('exercise-list');
  list.innerHTML = '';

  week.exercises.forEach(ex => {
    const checked = alreadyDone || !!state.todayChecks[ex.name];

    const li = document.createElement('li');
    li.className = 'exercise-item' + (checked ? ' is-checked' : '');

    const label = document.createElement('label');
    label.className = 'ex-label' + (alreadyDone ? ' disabled' : '');

    const input = document.createElement('input');
    input.type      = 'checkbox';
    input.className = 'ex-input';
    input.dataset.name = ex.name;
    input.checked   = checked;
    input.disabled  = alreadyDone;

    if (!alreadyDone) {
      input.addEventListener('change', onCheckboxChange);
    }

    const box = document.createElement('span');
    box.className = 'ex-check-box';

    const info = document.createElement('div');
    info.className = 'ex-info';
    info.innerHTML = `<span class="ex-name">${ex.name}</span>
                      <span class="ex-detail">${ex.detail}</span>`;

    label.append(input, box, info);
    li.append(label);
    list.append(li);
  });
}

/* ─────────────────────────────────────────────────────────────────────────
   Checkbox interaction
   ───────────────────────────────────────────────────────────────────────── */
function onCheckboxChange(e) {
  const name = e.target.dataset.name;
  state.todayChecks[name] = e.target.checked;

  // Toggle visual strikethrough on the list item
  const li = e.target.closest('.exercise-item');
  li.classList.toggle('is-checked', e.target.checked);

  saveState();

  // Check if every exercise is now ticked
  const week    = WEEKS[state.currentWeek];
  const allDone = week.exercises.every(ex => state.todayChecks[ex.name]);
  if (allDone) completeDay();
}

/* ─────────────────────────────────────────────────────────────────────────
   Complete today's workout
   ───────────────────────────────────────────────────────────────────────── */
function completeDay() {
  const today = todayStr();
  if (state.completedDays.includes(today)) return; // guard against double-fire

  state.completedDays.push(today);
  state.lastCompletedDate = today;
  state.daysAtLevel++;

  let leveledUp = false;
  if (state.daysAtLevel >= 7 && state.currentWeek < 4) {
    state.currentWeek++;
    state.daysAtLevel = 0;
    leveledUp = true;
  }

  saveState();
  renderWorkout();          // update progress bar and disable checkboxes
  showCongrats(leveledUp);  // overlay on top
}

/* ─────────────────────────────────────────────────────────────────────────
   Congrats overlay
   ───────────────────────────────────────────────────────────────────────── */
function showCongrats(leveledUp) {
  const msgEl  = document.getElementById('level-up-msg');
  const textEl = document.getElementById('level-up-text');

  if (leveledUp) {
    msgEl.hidden      = false;
    textEl.textContent = `You've advanced to Week ${state.currentWeek}!`;
  } else {
    msgEl.hidden = true;
  }

  document.getElementById('congrats-overlay').classList.add('visible');
}

/* ─────────────────────────────────────────────────────────────────────────
   Calendar view rendering
   ───────────────────────────────────────────────────────────────────────── */
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function renderCalendar() {
  const today        = todayStr();
  const completedSet = new Set(state.completedDays);

  // ── Header ──
  document.getElementById('cal-title').textContent =
    `${MONTH_NAMES[calMonth]} ${calYear}`;

  // ── Grid ──
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  // Day-of-week headers
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => {
    const el = document.createElement('div');
    el.className   = 'cal-day-hdr';
    el.textContent = d;
    grid.appendChild(el);
  });

  // Leading blank cells
  const firstDow = new Date(calYear, calMonth, 1).getDay();
  for (let i = 0; i < firstDow; i++) {
    const el = document.createElement('div');
    el.className = 'cal-cell empty';
    grid.appendChild(el);
  }

  // Day cells
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr    = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
    const isComplete = completedSet.has(dateStr);
    const isToday    = dateStr === today;

    const el = document.createElement('div');
    el.className = 'cal-cell'
      + (isComplete ? ' completed' : '')
      + (isToday    ? ' is-today'  : '');
    el.textContent = d;
    grid.appendChild(el);
  }

  // ── Stats ──
  document.getElementById('stat-total').textContent  = state.completedDays.length;
  document.getElementById('stat-streak').textContent = getCurrentStreak();
  document.getElementById('stat-week').textContent   = state.currentWeek;
}

/* ─────────────────────────────────────────────────────────────────────────
   Notification banner (used for drop-level warning)
   ───────────────────────────────────────────────────────────────────────── */
function showNotification(text) {
  document.getElementById('notif-text').textContent = text;
  document.getElementById('notification').classList.add('visible');

  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    document.getElementById('notification').classList.remove('visible');
  }, 8000);
}

/* ─────────────────────────────────────────────────────────────────────────
   Boot
   ───────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);

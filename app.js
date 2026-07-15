// app.js — screens, state, the practice loop, game history, and the
// "how did the program read my answer" helper.
// Depends on rng.js, checking.js, and lessons.js (loaded before this file).

const HISTORY_KEY = 'math-review-history';
const HISTORY_LIMIT = 10;

const state = {
  name: '',
  seed: null,
  rng: null,
  selectedLessonIds: [],
  stats: { correct: 0, attempted: 0 },
  lessonStats: {},
  currentQuestion: null,
  currentLessonId: null,
  gameStartedAt: null,
  lastUserInput: ''
};

let awaitingNext = false;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ---------- Screen 1: name ----------

function proceedFromName() {
  const nameInput = document.getElementById('name-input');
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }
  state.name = name;
  state.seed = Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF);
  state.rng = mulberry32(state.seed);
  console.log(`Session seed: ${state.seed} (note this down to describe/replay a session)`);

  renderLessonList();
  document.getElementById('lessons-greeting').textContent = `${state.name}, what are we studying today?`;
  showScreen('screen-lessons');
}

document.getElementById('name-next-btn').addEventListener('click', proceedFromName);
document.getElementById('name-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') proceedFromName();
});

// ---------- Screen 2: lesson picker ----------

function renderLessonList() {
  const container = document.getElementById('lesson-list');
  container.innerHTML = '';

  const categories = [...new Set(LESSONS.map(l => l.category))];
  categories.forEach(category => {
    const group = document.createElement('div');
    group.className = 'lesson-group';

    const heading = document.createElement('div');
    heading.className = 'lesson-group-heading';

    const headingText = document.createElement('h2');
    headingText.textContent = category;

    const selectAllLabel = document.createElement('label');
    selectAllLabel.className = 'select-all-label';
    const selectAllBox = document.createElement('input');
    selectAllBox.type = 'checkbox';
    selectAllBox.className = 'select-all-checkbox';
    selectAllBox.setAttribute('aria-label', `Select all ${category} lessons`);
    selectAllLabel.appendChild(selectAllBox);
    selectAllLabel.appendChild(document.createTextNode('All'));

    heading.appendChild(headingText);
    heading.appendChild(selectAllLabel);
    group.appendChild(heading);

    const checkboxes = [];
    LESSONS.filter(l => l.category === category).forEach(lesson => {
      const label = document.createElement('label');
      label.className = 'lesson-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = lesson.id;
      checkboxes.push(checkbox);
      checkbox.addEventListener('change', () => syncSelectAllState(selectAllBox, checkboxes));

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(lesson.label));
      group.appendChild(label);
    });

    selectAllBox.addEventListener('change', () => {
      checkboxes.forEach(cb => { cb.checked = selectAllBox.checked; });
      selectAllBox.indeterminate = false;
    });

    container.appendChild(group);
  });
}

// Keeps a category's "All" checkbox in sync with its individual lessons:
// checked when every lesson in the category is checked, indeterminate when
// some (but not all) are, unchecked when none are.
function syncSelectAllState(selectAllBox, checkboxes) {
  const checkedCount = checkboxes.filter(cb => cb.checked).length;
  selectAllBox.checked = checkedCount === checkboxes.length;
  selectAllBox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

function proceedFromLessons() {
  const checked = document.querySelectorAll('#lesson-list .lesson-item input[type="checkbox"]:checked');
  const ids = Array.from(checked).map(c => c.value);
  if (ids.length === 0) {
    alert('Pick at least one lesson to start.');
    return;
  }

  state.selectedLessonIds = ids;
  state.stats = { correct: 0, attempted: 0 };
  state.lessonStats = {};
  ids.forEach(id => {
    const lesson = LESSONS.find(l => l.id === id);
    state.lessonStats[id] = { label: lesson.label, correct: 0, attempted: 0 };
  });
  state.gameStartedAt = Date.now();

  showScreen('screen-practice');
  nextQuestion();
}

document.getElementById('start-btn').addEventListener('click', proceedFromLessons);

document.getElementById('history-btn').addEventListener('click', () => {
  renderHistory();
  showScreen('screen-history');
});

// ---------- Screen 3: practice loop ----------

function pickLesson() {
  const idx = randInt(state.rng, 0, state.selectedLessonIds.length - 1);
  const id = state.selectedLessonIds[idx];
  return LESSONS.find(l => l.id === id);
}

function nextQuestion() {
  const lesson = pickLesson();
  const result = lesson.generate(state.rng);
  state.currentQuestion = result;
  state.currentLessonId = lesson.id;

  const display = document.getElementById('question-display');
  display.innerHTML = '';
  katex.render(result.questionLatex, display, { throwOnError: false });

  const answerInput = document.getElementById('answer-input');
  answerInput.value = '';
  answerInput.focus();

  const feedback = document.getElementById('feedback');
  feedback.className = 'feedback';
  feedback.innerHTML = '';

  const interpretation = document.getElementById('interpretation');
  interpretation.hidden = true;
  interpretation.innerHTML = '';

  document.getElementById('submit-btn').textContent = 'Submit';
  awaitingNext = false;
  updateTally();
}

function updateTally() {
  document.getElementById('tally').textContent = `${state.stats.correct} / ${state.stats.attempted}`;
}

function showFeedback(correct) {
  const feedback = document.getElementById('feedback');
  const icon = correct
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 L9 17 L20 6"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6 L18 18 M18 6 L6 18"/></svg>';

  feedback.className = correct ? 'feedback correct' : 'feedback incorrect';
  feedback.innerHTML = icon;

  const text = document.createElement('span');
  if (correct) {
    text.textContent = 'Correct';
  } else {
    text.appendChild(document.createTextNode('Not quite — '));
    const answerEl = document.createElement('span');
    katex.render(state.currentQuestion.answer, answerEl, { throwOnError: false });
    text.appendChild(answerEl);
  }
  feedback.appendChild(text);

  if (!correct) {
    const helpBtn = document.createElement('button');
    helpBtn.type = 'button';
    helpBtn.className = 'interpret-btn';
    helpBtn.textContent = '?';
    helpBtn.setAttribute('aria-label', 'Show how your answer was interpreted');
    helpBtn.addEventListener('click', toggleInterpretation);
    feedback.appendChild(helpBtn);
  }
}

// Tries the raw input as one expression first, then falls back to the same
// splitting checkNumericSet uses (checking.js), in case it was meant as a
// multi-value answer like "3, -3". Returns a LaTeX string, or null if
// nothing could be parsed as math at all.
function interpretInput(input) {
  try {
    return math.parse(input).toTex();
  } catch (e) { /* fall through to the multi-value attempt below */ }

  try {
    const pieces = splitAnswers(input).flatMap(normalizePiece);
    if (pieces.length < 2) return null;
    return pieces.map(p => math.parse(p).toTex()).join(', \\quad ');
  } catch (e) {
    return null;
  }
}

function toggleInterpretation() {
  const interpretation = document.getElementById('interpretation');
  if (!interpretation.hidden) {
    interpretation.hidden = true;
    return;
  }

  const tex = interpretInput(state.lastUserInput);
  interpretation.innerHTML = '';

  if (tex === null) {
    interpretation.textContent = "Couldn't be read as a math expression — likely a typo or unsupported notation.";
  } else {
    const label = document.createElement('div');
    label.className = 'interpretation-label';
    label.textContent = 'The program read your answer as:';
    const rendered = document.createElement('div');
    katex.render(tex, rendered, { throwOnError: false });
    interpretation.appendChild(label);
    interpretation.appendChild(rendered);
  }
  interpretation.hidden = false;
}

document.getElementById('answer-form').addEventListener('submit', (e) => {
  e.preventDefault();

  if (awaitingNext) {
    nextQuestion();
    return;
  }

  const answerInput = document.getElementById('answer-input');
  const input = answerInput.value.trim();
  if (!input) return;

  state.lastUserInput = input;
  const correct = state.currentQuestion.checkAnswer(input);

  state.stats.attempted++;
  if (correct) state.stats.correct++;

  const lessonStat = state.lessonStats[state.currentLessonId];
  lessonStat.attempted++;
  if (correct) lessonStat.correct++;

  showFeedback(correct);
  document.getElementById('submit-btn').textContent = 'Next Question';
  updateTally();
  awaitingNext = true;
  answerInput.focus();
});

document.getElementById('end-game-btn').addEventListener('click', () => {
  if (!confirm('End this game? Your progress will be saved to history.')) return;

  const endedAt = Date.now();
  saveGameToHistory({
    name: state.name,
    seed: state.seed,
    startedAt: state.gameStartedAt,
    endedAt,
    totalTimeMs: endedAt - state.gameStartedAt,
    stats: { ...state.stats },
    lessonBreakdown: state.lessonStats
  });
  showScreen('screen-lessons');
});

// ---------- Screen 4: history ----------

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Could not read history from localStorage:', e);
    return [];
  }
}

function saveGameToHistory(game) {
  try {
    const history = loadHistory();
    history.unshift(game);
    while (history.length > HISTORY_LIMIT) history.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('Could not save history to localStorage:', e);
  }
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function renderHistory() {
  const history = loadHistory();
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  list.innerHTML = '';

  if (history.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  history.forEach(game => {
    const details = document.createElement('details');
    details.setAttribute('name', 'history-accordion');
    details.className = 'history-entry';

    const summary = document.createElement('summary');
    summary.className = 'history-summary';

    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'history-score';
    scoreSpan.textContent = `${game.stats.correct} / ${game.stats.attempted}`;

    const metaSpan = document.createElement('span');
    metaSpan.className = 'history-meta';
    const started = new Date(game.startedAt);
    const ended = new Date(game.endedAt);
    metaSpan.innerHTML =
      `${started.toLocaleString()} \u2013 ${ended.toLocaleTimeString()}<br>${formatDuration(game.totalTimeMs)} total`;

    summary.appendChild(scoreSpan);
    summary.appendChild(metaSpan);

    const detailsBody = document.createElement('div');
    detailsBody.className = 'history-details';

    const table = document.createElement('table');
    table.className = 'breakdown-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Lesson</th><th class="num">Correct</th><th class="num">Incorrect</th></tr>';
    const tbody = document.createElement('tbody');

    Object.values(game.lessonBreakdown).forEach(row => {
      const tr = document.createElement('tr');

      const labelTd = document.createElement('td');
      labelTd.textContent = row.label;

      const correctTd = document.createElement('td');
      correctTd.className = 'num';
      correctTd.textContent = row.correct;

      const incorrectTd = document.createElement('td');
      incorrectTd.className = 'num';
      incorrectTd.textContent = row.attempted - row.correct;

      tr.appendChild(labelTd);
      tr.appendChild(correctTd);
      tr.appendChild(incorrectTd);
      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    detailsBody.appendChild(table);

    details.appendChild(summary);
    details.appendChild(detailsBody);
    list.appendChild(details);
  });
}

document.getElementById('history-back-btn').addEventListener('click', () => {
  showScreen('screen-lessons');
});
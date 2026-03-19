/**
 * Személyiségteszt — dimenzió-agnosztikus logika
 *
 * Állapotok: selector → quiz → result → selector
 * Egy vagy több dimenzió futtatható egyszerre.
 * Kérdések round-robin interleaving-gel keverednek (nem blokkos sorrend).
 */

// ─── Konstansok ──────────────────────────────────────────────────────────────

const DIM_ORDER = ['ei', 'tf', 'jp', 'sn', 'pp'];

// Selector kártyák felirataira + az "összes" gombhoz
const DIM_META = {
  ei: { sub: { hu: 'Energia iránya',    en: 'Energy direction'   } },
  tf: { sub: { hu: 'Döntés alapja',     en: 'Decision basis'     } },
  jp: { sub: { hu: 'Struktúra igény',   en: 'Structure need'     } },
  sn: { sub: { hu: 'Észlelés módja',    en: 'Perception mode'    } },
  pp: { sub: { hu: 'Motiváció fókusza', en: 'Motivation focus'   } },
};

// Ha az A és B százaléka ennyinél közelebb van egymáshoz → "kiegyensúlyozott"
const BALANCED_THRESHOLD = 6;

// ─── DOM hivatkozások ─────────────────────────────────────────────────────────

const selectorSection = document.getElementById('dim-selector');
const dimGrid         = document.getElementById('dim-grid');
const quizSection     = document.getElementById('quiz');
const controlsEl      = document.getElementById('controls');
const resultSection   = document.getElementById('result');
const typeCodeWrap    = document.getElementById('type-code-wrap');
const typeCodeEl      = document.getElementById('type-code');
const resultDimsEl    = document.getElementById('result-dims');
const prevBtn         = document.getElementById('prevBtn');
const saveBtn         = document.getElementById('saveBtn');
const nextBtn         = document.getElementById('nextBtn');
const retryBtn        = document.getElementById('retryBtn');
const downloadBtn     = document.getElementById('downloadBtn');
const loadBtn         = document.getElementById('loadBtn');
const loadInput       = document.getElementById('loadInput');
const tmpl            = document.getElementById('question-template');

// ─── Futtatási állapot ────────────────────────────────────────────────────────

let data          = null;
let activeDimIds  = [];       // futó dimenziók ID-listája
let questions     = [];       // [{ id, text, pole, dimId }]
let answers       = {};       // id → 1..5
let idx           = 0;
let lastScores    = null;     // nyelvváltáshoz tárolt utolsó eredmény

// ─── Segédfüggvények ──────────────────────────────────────────────────────────

function getCurrentLang() {
  return document.documentElement.getAttribute('data-lang') || 'hu';
}

const ui = {
  finish:       { hu: 'Befejezés',   en: 'Finish'   },
  next:         { hu: 'Következő',   en: 'Next'      },
  back:         { hu: 'Vissza',      en: 'Back'      },
  pleaseAnswer: {
    hu: 'Kérlek válaszolj erre a kérdésre mielőtt továbbmennél.',
    en: 'Please answer this question before continuing.',
  },
  errorLoad: {
    hu: 'Hiba: a questions.json nem található.',
    en: 'Error: questions.json not found.',
  },
  errorFile: {
    hu: 'Érvénytelen mentési fájl.',
    en: 'Invalid save file.',
  },
  allDimsLabel: { hu: 'Összes dimenzió',    en: 'All dimensions'    },
  allDimsSub:   { hu: 'Mind az 5 egyszerre', en: 'All 5 at once'    },
  balanced:     { hu: 'Kiegyensúlyozott',   en: 'Balanced'         },
};

function t(key) {
  const lang = getCurrentLang();
  return ui[key]?.[lang] ?? ui[key]?.hu ?? key;
}

// ─── Állapot váltók ───────────────────────────────────────────────────────────

function showSelector() {
  selectorSection.classList.remove('hidden');
  quizSection.classList.add('hidden');
  controlsEl.classList.add('hidden');
  resultSection.classList.add('hidden');
  document.getElementById('page-title').setAttribute('data-hu', 'Személyiségteszt');
  document.getElementById('page-title').setAttribute('data-en', 'Personality Test');
  document.getElementById('page-title').textContent = getCurrentLang() === 'en' ? 'Personality Test' : 'Személyiségteszt';
}

function showQuiz() {
  selectorSection.classList.add('hidden');
  quizSection.classList.remove('hidden');
  controlsEl.classList.remove('hidden');
  resultSection.classList.add('hidden');
}

function showResult() {
  selectorSection.classList.add('hidden');
  quizSection.classList.add('hidden');
  controlsEl.classList.add('hidden');
  resultSection.classList.remove('hidden');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const res = await fetch('../data/pesonality-test-questions.json');
    data = await res.json();
  } catch (e) {
    quizSection.innerHTML = `<p class="error">${t('errorLoad')}</p>`;
    return;
  }
  renderSelector();
}

// ─── Selector ─────────────────────────────────────────────────────────────────

function renderSelector() {
  const lang = getCurrentLang();
  dimGrid.innerHTML = '';

  DIM_ORDER.forEach(id => {
    const dim  = data.dimensions[id];
    const meta = DIM_META[id];
    const btn  = makeDimButton(
      dim.label.hu, dim.label.en,
      meta.sub.hu,  meta.sub.en,
      false,
      () => startQuiz([id])
    );
    dimGrid.appendChild(btn);
  });

  // "Összes dimenzió" gomb
  const allBtn = makeDimButton(
    ui.allDimsLabel.hu, ui.allDimsLabel.en,
    ui.allDimsSub.hu,   ui.allDimsSub.en,
    true,
    () => startQuiz([...DIM_ORDER])
  );
  dimGrid.appendChild(allBtn);

  // language switcher nem tudja ezeket frissíteni (JS-generált),
  // ezért itt manuálisan alkalmazzuk a jelenlegi nyelvet
  applyLangToGrid(lang);
}

function makeDimButton(nameHu, nameEn, subHu, subEn, isAll, onClick) {
  const btn = document.createElement('button');
  btn.className = 'dim-btn' + (isAll ? ' dim-btn--all' : '');

  const nameSpan = document.createElement('span');
  nameSpan.className = 'dim-name';
  nameSpan.setAttribute('data-hu', nameHu);
  nameSpan.setAttribute('data-en', nameEn);

  const subSpan = document.createElement('span');
  subSpan.className = 'dim-sub';
  subSpan.setAttribute('data-hu', subHu);
  subSpan.setAttribute('data-en', subEn);

  btn.appendChild(nameSpan);
  btn.appendChild(subSpan);
  btn.addEventListener('click', onClick);
  return btn;
}

function applyLangToGrid(lang) {
  dimGrid.querySelectorAll('[data-hu][data-en]').forEach(el => {
    el.textContent = el.dataset[lang];
  });
}

// ─── Quiz felépítés ───────────────────────────────────────────────────────────

function startQuiz(dimIds) {
  activeDimIds = dimIds;
  answers = {};
  idx = 0;
  lastScores = null;
  buildQuestions();
  showQuiz();
  renderQuestion(idx);
}

/**
 * Round-robin interleaving: minden dimenzióból felváltva vesszük a kérdéseket,
 * és azon belül is felváltva az A és B pólusokat.
 * Eredmény: egymás utáni kérdések sosem ugyanabból a dimenzióból valók.
 */
function buildQuestions() {
  const lang = getCurrentLang();
  let globalId = 0;

  // Minden dimenzióhoz elkészítjük az A/B felváltva rendezett sorát
  const dimArrays = activeDimIds.map(dimId => {
    const poles = data.dimensions[dimId].poles;
    const as = poles.a[lang].map(text => ({ text, pole: 'a', dimId }));
    const bs = poles.b[lang].map(text => ({ text, pole: 'b', dimId }));
    const interleaved = [];
    const len = Math.max(as.length, bs.length);
    for (let i = 0; i < len; i++) {
      if (i < as.length) interleaved.push(as[i]);
      if (i < bs.length) interleaved.push(bs[i]);
    }
    return interleaved;
  });

  // Round-robin az összes dimenzión át
  const maxLen = Math.max(...dimArrays.map(a => a.length));
  const result = [];
  for (let i = 0; i < maxLen; i++) {
    for (const arr of dimArrays) {
      if (i < arr.length) result.push(arr[i]);
    }
  }

  questions = result.map(q => ({ ...q, id: globalId++ }));
}

// ─── Kérdés megjelenítés ──────────────────────────────────────────────────────

function renderQuestion(i) {
  quizSection.innerHTML = '';
  const q    = questions[i];
  const node = tmpl.content.cloneNode(true);

  node.querySelector('.q-title').textContent = `${i + 1}. ${q.text}`;
  const scale = node.querySelector('.scale');

  for (let v = 1; v <= 5; v++) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    const span  = document.createElement('span');

    input.type  = 'radio';
    input.name  = `q${q.id}`;
    input.value = v;
    if (answers[q.id] === v) input.checked = true;
    span.textContent = v;

    label.appendChild(input);
    label.appendChild(span);
    scale.appendChild(label);

    input.addEventListener('change', () => { answers[q.id] = v; });
  }

  quizSection.appendChild(node);
  prevBtn.disabled    = (i === 0);
  nextBtn.textContent = (i === questions.length - 1) ? t('finish') : t('next');
}

// ─── Navigáció ────────────────────────────────────────────────────────────────

prevBtn.addEventListener('click', () => {
  if (idx > 0) { idx--; renderQuestion(idx); }
});

nextBtn.addEventListener('click', () => {
  if (!answers.hasOwnProperty(questions[idx].id)) {
    alert(t('pleaseAnswer'));
    return;
  }
  if (idx < questions.length - 1) {
    idx++;
    renderQuestion(idx);
  } else {
    finish();
  }
});

retryBtn.addEventListener('click', () => {
  showSelector();
  renderSelector();
});

saveBtn.addEventListener('click', () => saveState(false));
downloadBtn.addEventListener('click', () => saveState(true));
loadBtn.addEventListener('click', () => loadInput.click());
loadInput.addEventListener('change', e => {
  if (e.target.files[0]) loadState(e.target.files[0]);
  e.target.value = '';
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && answers.hasOwnProperty(questions[idx]?.id)) {
    nextBtn.click();
  }
});

// ─── Kiértékelés ─────────────────────────────────────────────────────────────

function finish() {
  const lang   = getCurrentLang();
  const scores = {};

  activeDimIds.forEach(dimId => {
    const poles  = data.dimensions[dimId].poles;
    const dimQs  = questions.filter(q => q.dimId === dimId);
    let aTotal   = 0, bTotal = 0;

    dimQs.forEach(q => {
      const val = answers[q.id] || 0;
      if (q.pole === 'a') aTotal += val;
      else                bTotal += val;
    });

    const aMax   = poles.a[lang].length * 5;
    const bMax   = poles.b[lang].length * 5;
    scores[dimId] = {
      aTotal, bTotal,
      aPerc: Math.round((aTotal / aMax) * 100),
      bPerc: Math.round((bTotal / bMax) * 100),
    };
  });

  lastScores = scores;
  renderResults(scores);
  showResult();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Eredmény renderelés ──────────────────────────────────────────────────────

function renderResults(scores) {
  const lang        = getCurrentLang();
  const isMultiDim  = activeDimIds.length > 1;

  resultDimsEl.innerHTML = '';

  if (isMultiDim) {
    // Típusjelölés összeállítása
    const parts = activeDimIds.map(id =>
      getDominantPoleName(data.dimensions[id], scores[id], lang)
    );
    typeCodeEl.textContent = parts.join(' · ');
    typeCodeWrap.classList.remove('hidden');
  } else {
    typeCodeWrap.classList.add('hidden');
  }

  // Dimenzió kártyák
  activeDimIds.forEach(dimId => {
    const card = buildDimCard(dimId, data.dimensions[dimId], scores[dimId], lang);
    resultDimsEl.appendChild(card);
  });

  // Bar animáció: csak a következő frame-ben indítjuk, hogy a CSS transition fusson
  requestAnimationFrame(() => {
    resultDimsEl.querySelectorAll('.bar .fill[data-width]').forEach(fill => {
      fill.style.width = fill.dataset.width;
    });
  });
}

function buildDimCard(dimId, dim, score, lang) {
  const { aTotal, bTotal, aPerc, bPerc } = score;
  const poles    = dim.poles;
  const isBalanced = Math.abs(aPerc - bPerc) <= BALANCED_THRESHOLD;
  const dominantPole = isBalanced ? null : (aPerc >= bPerc ? 'a' : 'b');

  // Leírás kiválasztása
  let desc;
  if (isBalanced) {
    desc = poles.balanced.description[lang];
  } else {
    desc = poles[dominantPole].description[lang];
  }

  const card = document.createElement('div');
  card.className = `dim-result-card dim-result-card--${dimId}`;

  // Fejléc
  const heading = document.createElement('h3');
  heading.textContent = dim.label[lang];
  card.appendChild(heading);

  // Barok
  const barsWrap = document.createElement('div');
  barsWrap.className = 'result-bars';

  [
    { pole: 'a', label: poles.a.label[lang], perc: aPerc, total: aTotal, isDominant: dominantPole === 'a' },
    { pole: 'b', label: poles.b.label[lang], perc: bPerc, total: bTotal, isDominant: dominantPole === 'b' },
  ].forEach(({ label, perc, total, isDominant }) => {
    const wrap = document.createElement('div');
    wrap.className = 'bar-wrap' + (isDominant ? ' bar-wrap--dominant' : '');

    const labelEl = document.createElement('span');
    labelEl.className = 'bar-label';
    labelEl.textContent = label;

    const barEl = document.createElement('div');
    barEl.className = 'bar';
    const fillEl = document.createElement('div');
    fillEl.className = 'fill';
    fillEl.style.width = '0%';
    fillEl.dataset.width = perc + '%';  // animációhoz
    barEl.appendChild(fillEl);

    const pctEl = document.createElement('span');
    pctEl.className = 'pct';
    pctEl.textContent = perc + '%';

    wrap.appendChild(labelEl);
    wrap.appendChild(barEl);
    wrap.appendChild(pctEl);
    barsWrap.appendChild(wrap);
  });

  card.appendChild(barsWrap);

  // Leírás
  const descEl = document.createElement('p');
  descEl.className = 'dim-desc';
  descEl.textContent = desc;
  card.appendChild(descEl);

  return card;
}

/**
 * Visszaadja a domináns pólus nevét a típusjelöléshez.
 * Kiegyensúlyozottnál: "A/B" formátum.
 */
function getDominantPoleName(dim, score, lang) {
  const { aPerc, bPerc } = score;
  if (Math.abs(aPerc - bPerc) <= BALANCED_THRESHOLD) {
    return dim.poles.a.label[lang] + '/' + dim.poles.b.label[lang];
  }
  return aPerc >= bPerc ? dim.poles.a.label[lang] : dim.poles.b.label[lang];
}

// ─── Nyelvváltás kezelése ─────────────────────────────────────────────────────

const langObserver = new MutationObserver(mutations => {
  mutations.forEach(m => {
    if (m.attributeName !== 'data-lang' || !data) return;
    const lang = getCurrentLang();

    // Selector: manuálisan frissítjük a JS-generált gombokat
    applyLangToGrid(lang);

    // Quiz: újraépítés az új nyelvű kérdésekkel (válaszok megmaradnak)
    if (!quizSection.classList.contains('hidden')) {
      buildQuestions();
      renderQuestion(idx);
    }

    // Eredmény: újrarenderelés az új nyelven
    if (!resultSection.classList.contains('hidden') && lastScores) {
      renderResults(lastScores);
    }
  });
});

langObserver.observe(document.documentElement, { attributes: true });

// ─── Mentés / Betöltés ───────────────────────────────────────────────────────

function saveState(done) {
  const state = { v: 1, dimIds: activeDimIds, answers, idx, done };
  const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = done ? 'personality-test-befejezett.json' : 'personality-test-felbe-hagyott.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function loadState(file) {
  let state;
  try {
    state = JSON.parse(await file.text());
  } catch {
    alert(t('errorFile'));
    return;
  }

  if (state.v !== 1 || !Array.isArray(state.dimIds) || typeof state.answers !== 'object') {
    alert(t('errorFile'));
    return;
  }

  activeDimIds = state.dimIds;
  answers = state.answers;
  buildQuestions();

  if (state.done) {
    lastScores = null;
    finish();
  } else {
    idx = state.idx ?? 0;
    showQuiz();
    renderQuestion(idx);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

init();

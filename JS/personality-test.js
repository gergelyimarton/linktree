// egyszerű frontend logika: kérdések beolvasása, oldalanként 1 kérdés megjelenítése, eredmény számítása
const quizEl = document.getElementById('quiz');
const tmpl = document.getElementById('question-template');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const resultSection = document.getElementById('result');
const resultText = document.getElementById('resultText');
const retryBtn = document.getElementById('retryBtn');
const sunBar = document.querySelector('#sunBar .fill');
const moonBar = document.querySelector('#moonBar .fill');
const sunScoreEl = document.getElementById('sunScore');
const moonScoreEl = document.getElementById('moonScore');

// Translation helper
function getCurrentLang() {
  return document.documentElement.getAttribute('data-lang') || 'hu';
}

const translations = {
  finish: { hu: 'Befejezés', en: 'Finish' },
  next: { hu: 'Következő', en: 'Next' },
  pleaseAnswer: { hu: 'Kérlek válaszolj erre a kérdésre mielőtt továbbmennél.', en: 'Please answer this question before continuing.' },
  errorLoading: { hu: 'Hiba: a questions.json nem található. Ellenőrizd, hogy ugyanabban a mappában van-e a fájl, és hogy a weboldalt statikus szerveren futtatod.', en: 'Error: questions.json not found. Check if the file exists in the same folder and that you are running the website on a static server.' }
};

function t(key) {
  const lang = getCurrentLang();
  return translations[key]?.[lang] || translations[key]?.hu || key;
}

let data = null;
let questions = []; // array of {id, text, type}
let answers = {}; // id -> 1..5
let idx = 0;

function buildQuestions() {
  const lang = getCurrentLang();
  questions = [];
  let id = 0;
  data.sun[lang].forEach(q => { questions.push({id: id++, text:q, type:'sun'})});
  data.moon[lang].forEach(q => { questions.push({id: id++, text:q, type:'moon'})});
}

async function init(){
  try{
    const res = await fetch('../data/pesonality-test-questions.json');
    data = await res.json();
  }catch(e){
    console.error('Nem sikerült betölteni a questions.json-t.');
    quizEl.innerHTML = `<p class="error">${t('errorLoading')}</p>`;
    return;
  }

  buildQuestions();
  renderQuestion(idx);
}

function renderQuestion(i){
  quizEl.innerHTML = '';
  const q = questions[i];
  const node = tmpl.content.cloneNode(true);
  node.querySelector('.q-title').textContent = `${i+1}. ${q.text}`;
  const scale = node.querySelector('.scale');

  for(let v=1; v<=5; v++){
    const id = `q${q.id}_v${v}`;
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio'; input.name = `q${q.id}`; input.id = id; input.value = v;
    if(answers[q.id] && answers[q.id] == v) input.checked = true;
    const span = document.createElement('span');
    span.textContent = v;
    label.appendChild(input);
    label.appendChild(span);
    scale.appendChild(label);

    input.addEventListener('change', ()=>{
      answers[q.id] = Number(input.value);
    })
  }

  quizEl.appendChild(node);
  prevBtn.disabled = (i===0);
  nextBtn.textContent = (i === questions.length-1) ? t('finish') : t('next');
}

prevBtn.addEventListener('click', ()=>{
  if(idx>0){
    idx--;
    renderQuestion(idx);
  }
});

nextBtn.addEventListener('click', ()=>{
  if(!answers.hasOwnProperty(questions[idx].id)){
    alert(t('pleaseAnswer'));
    return;
  }
  if(idx < questions.length-1){
    idx++;
    renderQuestion(idx);
  }
  else { finish(); }
});

retryBtn.addEventListener('click', ()=>{
  answers = {};
  idx = 0;
  resultSection.classList.add('hidden');
  renderQuestion(idx);
  window.scrollTo({top:0,behavior:'smooth'});
});

function finish(){
  const lang = getCurrentLang();

  // összeszámoljuk a Nap és Hold pontokat
  let sunTotal = 0, moonTotal = 0;
  questions.forEach(q => {
    const val = answers[q.id] || 0;
    if(q.type === 'sun') sunTotal += val;
    else moonTotal += val;
  });

  const sunMax = data.sun[lang].length * 5;
  const moonMax = data.moon[lang].length * 5;

  const sunPerc = Math.round((sunTotal / sunMax) * 100);
  const moonPerc = Math.round((moonTotal / moonMax) * 100);

  // kitöltés animáció
  sunBar.style.width = sunPerc + '%';
  moonBar.style.width = moonPerc + '%';
  sunScoreEl.textContent = sunTotal;
  moonScoreEl.textContent = moonTotal;

  // leírás kiválasztása
  let desc = '';
  if(Math.abs(sunPerc - moonPerc) <= 2) desc = data.descriptions.balanced[lang];
  else if(sunPerc > moonPerc) desc = data.descriptions.sun[lang];
  else desc = data.descriptions.moon[lang];

  resultText.textContent = desc;
  resultSection.classList.remove('hidden');
  window.scrollTo({top:document.body.scrollHeight, behavior:'smooth'});
}

// init
init();

// Globális ENTER listener a Következő/Befejezés gombhoz
document.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' && answers.hasOwnProperty(questions[idx].id)){
    nextBtn.click();
  }
});

// Update questions and button text when language changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.attributeName === 'data-lang' && data && questions.length > 0) {
      // Rebuild questions with new language
      buildQuestions();
      // Re-render current question
      renderQuestion(idx);
      // Update result description if visible
      if (!resultSection.classList.contains('hidden')) {
        const lang = getCurrentLang();
        const sunMax = data.sun[lang].length * 5;
        const moonMax = data.moon[lang].length * 5;
        let sunTotal = 0, moonTotal = 0;
        questions.forEach(q => {
          const val = answers[q.id] || 0;
          if(q.type === 'sun') sunTotal += val;
          else moonTotal += val;
        });
        const sunPerc = Math.round((sunTotal / sunMax) * 100);
        const moonPerc = Math.round((moonTotal / moonMax) * 100);
        let desc = '';
        if(Math.abs(sunPerc - moonPerc) <= 2) desc = data.descriptions.balanced[lang];
        else if(sunPerc > moonPerc) desc = data.descriptions.sun[lang];
        else desc = data.descriptions.moon[lang];
        resultText.textContent = desc;
      }
    }
  });
});
observer.observe(document.documentElement, { attributes: true });

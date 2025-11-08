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

let data = null;
let questions = []; // array of {id, text, type}
let answers = {}; // id -> 1..5
let idx = 0;

async function init(){
  try{
    const res = await fetch('../data/pesonality-test-questions.json');
    data = await res.json();
  }catch(e){
    console.error('Nem sikerült betölteni a questions.json-t.');
    quizEl.innerHTML = '<p class="error">Hiba: a questions.json nem található. Ellenőrizd, hogy ugyanabban a mappában van-e a fájl, és hogy a weboldalt statikus szerveren futtatod.</p>';
    return;
  }

  // építsük fel a kérdés listát
  let id = 0;
  data.sun.forEach(q => { questions.push({id: id++, text:q, type:'sun'})});
  data.moon.forEach(q => { questions.push({id: id++, text:q, type:'moon'})});

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
  nextBtn.textContent = (i === questions.length-1) ? 'Befejezés' : 'Következő';
}

prevBtn.addEventListener('click', ()=>{ 
  if(idx>0){ 
    idx--; 
    renderQuestion(idx);
  } 
});

nextBtn.addEventListener('click', ()=>{
  if(!answers.hasOwnProperty(questions[idx].id)){
    alert('Kérlek válaszolj erre a kérdésre mielőtt továbbmennél.');
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
  // összeszámoljuk a Nap és Hold pontokat
  let sunTotal = 0, moonTotal = 0;
  questions.forEach(q => {
    const val = answers[q.id] || 0;
    if(q.type === 'sun') sunTotal += val;
    else moonTotal += val;
  });

  const sunMax = data.sun.length * 5;
  const moonMax = data.moon.length * 5;

  const sunPerc = Math.round((sunTotal / sunMax) * 100);
  const moonPerc = Math.round((moonTotal / moonMax) * 100);

  // kitöltés animáció
  sunBar.style.width = sunPerc + '%';
  moonBar.style.width = moonPerc + '%';
  sunScoreEl.textContent = sunTotal;
  moonScoreEl.textContent = moonTotal;

  // leírás kiválasztása
  let desc = '';
  if(Math.abs(sunPerc - moonPerc) <= 2) desc = data.descriptions.balanced;
  else if(sunPerc > moonPerc) desc = data.descriptions.sun;
  else desc = data.descriptions.moon;

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

/* ============================================================
   MOTEUR PARTAGE POUR TOUS LES MODULES DE MATHEMATIQUES 5e-6e
   ============================================================
   Chaque page module-N.html appelle MathEngine.initModule(config)
   avec son propre contenu (theorie, flashcards, jeu, quiz, examen).
*/
(function(){

const REGISTRY_KEY = 'math_5e6e_registry';

/* ============================================================
   TELEMETRIE (tableau de bord centralise) : envoi discret et
   sans blocage vers le Worker de progression. N'affecte jamais
   l'usage local si le reseau ou le Worker est indisponible.
   ============================================================ */
const TELEMETRY_COURSE = 'math';
const TELEMETRY_URL = 'https://ines-progress-api.mertens-david-1972.workers.dev/event';
const TELEMETRY_KEY = 'cqU9qN47SRcwvLztKCY5hKXDDr83MCPk';
function sendTelemetry(moduleId, type, payload){
  try{
    fetch(TELEMETRY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: TELEMETRY_KEY, course: TELEMETRY_COURSE, moduleId, type, payload: payload||{} }),
      keepalive: true
    }).catch(function(){});
  }catch(e){}
}
function startHeartbeat(moduleId){
  let accum = 0, lastTick = null;
  function flush(){
    if(accum < 1) return;
    const seconds = Math.round(accum);
    accum = 0;
    sendTelemetry(moduleId, 'heartbeat', { seconds });
  }
  function tick(){
    if(document.visibilityState === 'visible'){
      const now = Date.now();
      if(lastTick) accum += (now - lastTick)/1000;
      lastTick = now;
    } else {
      lastTick = null;
    }
    if(accum >= 20) flush();
  }
  setInterval(tick, 5000);
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden'){ tick(); flush(); }
  });
  window.addEventListener('pagehide', function(){
    tick();
    if(accum >= 1 && navigator.sendBeacon){
      const seconds = Math.round(accum);
      navigator.sendBeacon(TELEMETRY_URL, new Blob([JSON.stringify({ key: TELEMETRY_KEY, course: TELEMETRY_COURSE, moduleId, type:'heartbeat', payload:{ seconds } })], { type:'application/json' }));
      accum = 0;
    }
  });
}

/* ============================================================
   LECTURE VOCALE des reponses du tuteur (voix ElevenLabs, via le
   Worker ines-progress-api : POST /speak).
   ============================================================ */
let _currentAudio = null;
function speakText(text){
  if(!text) return;
  stopSpeaking();
  fetch(TELEMETRY_URL.replace('/event','/speak'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: TELEMETRY_KEY, text: text })
  }).then(function(res){
    if(!res.ok) throw new Error('tts failed');
    return res.blob();
  }).then(function(blob){
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    _currentAudio = audio;
    audio.addEventListener('ended', function(){ URL.revokeObjectURL(url); if(_currentAudio === audio) _currentAudio = null; });
    audio.play().catch(function(){});
  }).catch(function(){});
}
function stopSpeaking(){
  if(_currentAudio){
    try{ _currentAudio.pause(); }catch(e){}
    _currentAudio = null;
  }
}

function loadRegistry(){
  try{ const raw = localStorage.getItem(REGISTRY_KEY); if(raw) return JSON.parse(raw); }catch(e){}
  return {};
}
function saveRegistry(reg){ try{ localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg)); }catch(e){} }
function getModuleStatus(moduleId){
  const reg = loadRegistry();
  return reg[moduleId] || { passed:false, bestPct:0 };
}
function setModulePassed(moduleId, pct){
  const reg = loadRegistry();
  const cur = reg[moduleId] || { passed:false, bestPct:0 };
  reg[moduleId] = { passed: cur.passed || pct >= 60, bestPct: Math.max(cur.bestPct||0, pct) };
  saveRegistry(reg);
}

/* ============================================================
   OUTILS DE COMPARAISON DE TEXTE / NOMBRES
   ============================================================ */
function normalize(str){
  return (str||'').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9.,+\-/*^() ]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function textMatches(input, accepted){
  const n = normalize(input);
  return accepted.some(a => n === normalize(a) || (n.length>2 && n.includes(normalize(a))));
}
function numericMatches(input, accepted, tolerance){
  const raw = (input||'').toString().trim().replace(',', '.');
  const num = parseFloat(raw);
  if(!isNaN(num)){
    const numOk = accepted.some(a => typeof a === 'number' && Math.abs(num - a) <= (tolerance!==undefined?tolerance:0.01));
    if(numOk) return true;
  }
  return textMatches(raw, accepted.filter(a => typeof a === 'string'));
}

/* ============================================================
   MOTEUR GENERIQUE DE QUESTIONS (quiz + examen)
   ============================================================ */
function renderMcq(q, idx, prefix){
  const name = prefix+'-'+idx;
  return `<div class="options">${q.options.map((o,i)=>`<label><input type="radio" name="${name}" value="${i}"> ${o}</label>`).join('')}</div>`;
}
function renderTf(q, idx, prefix){
  const name = prefix+'-'+idx;
  return `<div class="options">
    <label><input type="radio" name="${name}" value="true"> Vrai</label>
    <label><input type="radio" name="${name}" value="false"> Faux</label>
  </div>`;
}
function renderMatch(q, idx, prefix){
  return q.items.map((item, j)=>{
    const optsHtml = item.options.map(o=>`<option value="${o}">${o}</option>`).join('');
    return `<div class="match-row"><span class="left">${item.left}</span>
      <select class="match-select" id="${prefix}-${idx}-${j}">
        <option value="">-- choisir --</option>${optsHtml}
      </select></div>`;
  }).join('');
}
function renderClassify(q, idx, prefix){
  const opts = q.classifyOptions || ['Vrai','Faux'];
  return q.items.map((item,j)=>{
    return `<div class="match-row"><span class="left">${item.text}</span>
      <select class="match-select" id="${prefix}-${idx}-${j}">
        <option value="">-- choisir --</option>
        ${opts.map(o=>`<option value="${o}">${o}</option>`).join('')}
      </select></div>`;
  }).join('');
}
function renderData(q, idx, prefix){
  let sub = q.subquestions.map((sq,j)=>`
    <p style="margin-bottom:4px;"><strong>${j+1}.</strong> ${sq.prompt}</p>
    <input class="text-answer" id="${prefix}-${idx}-${j}" type="text" placeholder="Ta reponse">
  `).join('');
  return `${q.tableHtml||''}<div style="margin-top:10px;">${sub}</div>`;
}
function renderOpen(q, idx, prefix){
  return `<textarea class="open-answer" id="${prefix}-${idx}"></textarea>`;
}
function renderNumeric(q, idx, prefix){
  return `<input class="text-answer" id="${prefix}-${idx}" type="text" placeholder="Ta reponse">`;
}
function renderQuestionBody(q, idx, prefix){
  switch(q.type){
    case 'mcq': return renderMcq(q, idx, prefix);
    case 'tf': return renderTf(q, idx, prefix);
    case 'match': return renderMatch(q, idx, prefix);
    case 'classify': return renderClassify(q, idx, prefix);
    case 'data': return renderData(q, idx, prefix);
    case 'open': return renderOpen(q, idx, prefix);
    case 'numeric': return renderNumeric(q, idx, prefix);
  }
  return '';
}
function gradeQuestion(q, idx, prefix){
  let earned = 0, detail = '';
  switch(q.type){
    case 'mcq': {
      const sel = document.querySelector(`input[name="${prefix}-${idx}"]:checked`);
      const ok = sel && parseInt(sel.value,10) === q.correct;
      earned = ok ? q.points : 0;
      detail = ok ? 'Exact.' : `Reponse attendue : ${q.options[q.correct]}.`;
      break;
    }
    case 'tf': {
      const sel = document.querySelector(`input[name="${prefix}-${idx}"]:checked`);
      const ok = sel && (sel.value === String(q.correct));
      earned = ok ? q.points : 0;
      detail = ok ? 'Exact.' : `Reponse attendue : ${q.correct ? 'Vrai' : 'Faux'}.`;
      break;
    }
    case 'match': {
      const per = q.points / q.items.length;
      let good = 0;
      q.items.forEach((item,j)=>{
        const el = document.getElementById(`${prefix}-${idx}-${j}`);
        if(el && el.value === item.correct) good++;
      });
      earned = +(good*per).toFixed(2);
      detail = `${good} / ${q.items.length} associations correctes.`;
      break;
    }
    case 'classify': {
      const per = q.points / q.items.length;
      let good = 0;
      q.items.forEach((item,j)=>{
        const el = document.getElementById(`${prefix}-${idx}-${j}`);
        if(el && el.value === item.correct) good++;
      });
      earned = +(good*per).toFixed(2);
      detail = `${good} / ${q.items.length} classements corrects.`;
      break;
    }
    case 'data': {
      const per = q.points / q.subquestions.length;
      let good = 0;
      q.subquestions.forEach((sq,j)=>{
        const el = document.getElementById(`${prefix}-${idx}-${j}`);
        if(el && (sq.tolerance!==undefined ? numericMatches(el.value, sq.accepted, sq.tolerance) : textMatches(el.value, sq.accepted))) good++;
      });
      earned = +(good*per).toFixed(2);
      detail = `${good} / ${q.subquestions.length} reponses correctes.`;
      break;
    }
    case 'numeric': {
      const el = document.getElementById(`${prefix}-${idx}`);
      const ok = el && numericMatches(el.value, q.accepted, q.tolerance);
      earned = ok ? q.points : 0;
      detail = ok ? 'Exact.' : `Reponse attendue : ${q.acceptedDisplay || q.accepted.join(' ou ')}.`;
      break;
    }
    case 'open': {
      const el = document.getElementById(`${prefix}-${idx}`);
      const val = normalize(el ? el.value : '');
      let hits = 0;
      q.keywordGroups.forEach(group=>{ if(group.some(k=>val.includes(normalize(k)))) hits++; });
      const ratio = hits / q.keywordGroups.length;
      earned = +(ratio * q.points).toFixed(2);
      detail = `Correction automatique approximative, basee sur des mots-cles (${hits}/${q.keywordGroups.length} idees attendues detectees). Compare surtout ta reponse au corrige-modele.`;
      break;
    }
  }
  return { earned, detail };
}

/* ============================================================
   INITIALISATION D'UN MODULE
   ============================================================ */
function initModule(cfg){
  const STORAGE_KEY = 'math_5e6e_' + cfg.id;
  let state = loadState();
  function loadState(){
    try{ const raw = localStorage.getItem(STORAGE_KEY); if(raw) return JSON.parse(raw); }catch(e){}
    return { theoryDone:false, exerciseDone:false, theoryStepSeen:0, attempts:[] };
  }
  function saveState(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }
  function bestScorePct(){ if(!state.attempts.length) return 0; return Math.max(...state.attempts.map(a=>a.pct)); }
  function hasPassed(){ return bestScorePct() >= (cfg.passThreshold||60); }

  const root = document.getElementById('app-root');
  root.innerHTML = `
  <div class="app">
    <div class="top-nav">
      <a class="hub-link" href="${cfg.hubHref || 'index.html'}">&larr; Tous les modules</a>
      <a class="hub-link" href="https://portail-ines.pages.dev/" target="_blank" rel="noopener">Tableau de bord &#8599;</a>
    </div>
    <header class="top">
      <div class="eyebrow">${cfg.eyebrow}</div>
      <h1>${cfg.title}</h1>
      <p class="subtitle">${cfg.subtitle}</p>
    </header>
    <nav class="stepper">
      <button class="step-btn" data-view="accueil">Accueil</button>
      <button class="step-btn" data-view="theorie">1. Theorie</button>
      <button class="step-btn" data-view="exercices">2. Entrainement</button>
      <button class="step-btn" data-view="examen">3. Examen</button>
    </nav>

    <section id="view-accueil" class="view">
      <div class="panel">
        <span class="badge">A propos de ce module</span>
        <h2>Comment fonctionne ce parcours ?</h2>
        ${cfg.introHtml}
        <h3>Les trois etapes</h3>
        <ol class="clean">
          <li><strong>Theorie</strong> : sections courtes a lire dans l'ordre, avec les formules et des exemples resolus. Rien n'est chronometre.</li>
          <li><strong>Entrainement</strong> : flashcards, un jeu adapte au chapitre, et un quiz sans note qui compte. Autant d'essais que tu veux.</li>
          <li><strong>Examen</strong> : questions notees. Il faut ${cfg.passThreshold||60}% pour reussir et debloquer le module suivant. Essais illimites.</li>
        </ol>
        <div class="callout">Ta progression est enregistree automatiquement dans ton navigateur, tant que tu reviens sur ce meme lien.</div>
        <div class="btn-row"><button class="btn" data-go="theorie">Commencer la theorie</button></div>
      </div>
      <div id="progress-summary" class="panel"></div>
      <div style="text-align:center; margin-top: 10px;"><button class="reset-link" id="reset-btn">Reinitialiser ma progression sur ce module</button></div>
    </section>

    <section id="view-theorie" class="view">
      <div class="panel">
        <span class="badge">Theorie</span>
        <div id="theory-slides"></div>
        <div class="theory-nav">
          <button class="btn secondary" id="theory-prev">Precedent</button>
          <span class="theory-progress" id="theory-progress-label"></span>
          <button class="btn" id="theory-next">Suivant</button>
        </div>
      </div>
      <div class="theory-help">
        <button class="theory-help-toggle" id="theory-help-toggle" type="button">Une question sur cette section ?</button>
        <div class="theory-help-panel" id="theory-help-panel" hidden>
          <div class="theory-help-head">
            <strong>Pose ta question sur cette section</strong>
            <button class="theory-help-close" id="theory-help-close" type="button" aria-label="Fermer">&times;</button>
          </div>
          <div class="theory-help-log" id="theory-help-log"></div>
          <div class="theory-help-input-row">
            <input type="text" id="theory-help-input" placeholder="Ex : pourquoi... ? Que veut dire... ?" autocomplete="off">
            <button class="btn" id="theory-help-send" type="button">Envoyer</button>
          </div>
          <p class="theory-help-note">Le tuteur ne repond que sur le contenu de cette section.</p>
        </div>
      </div>
    </section>

    <section id="view-exercices" class="view">
      <div class="panel">
        <span class="badge">Entrainement</span>
        <h2>Entraine-toi sans pression</h2>
        <p>Rien ici ne compte pour une note. Choisis un format, autant de fois que tu veux.</p>
        <div class="subnav">
          <button class="subnav-btn active" id="subnav-flashcards">Flashcards</button>
          <button class="subnav-btn" id="subnav-jeu">${cfg.gameLabel || 'Jeu'}</button>
          <button class="subnav-btn" id="subnav-quiz">Quiz</button>
        </div>
        <div id="ex-tab-flashcards" class="ex-tab active">
          <p style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:0.88rem; color:var(--ink-soft);">Retourne la carte, puis dis honnetement si tu savais la reponse.</p>
          <div id="flashcards-area"></div>
        </div>
        <div id="ex-tab-jeu" class="ex-tab">
          <div id="game-area"></div>
        </div>
        <div id="ex-tab-quiz" class="ex-tab">
          <p style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:0.88rem; color:var(--ink-soft);">Reponds, clique sur « Verifier », lis l'explication, puis passe a la suite.</p>
          <div id="exercices-list"></div>
        </div>
        <div class="btn-row"><button class="btn" id="ex-done-btn">J'ai fini de m'entrainer, aller a l'examen</button></div>
      </div>
    </section>

    <section id="view-examen" class="view">
      <div class="panel" id="exam-panel">
        <span class="badge warn">Examen &middot; valeur certificative</span>
        <h2>Examen : ${cfg.examTitle||cfg.title}</h2>
        <p>${cfg.examBank.length} questions, ${cfg.examBank.reduce((s,q)=>s+q.points,0)} points au total. Seuil de reussite : ${cfg.passThreshold||60}%. Essais illimites.</p>
        <div id="exam-questions"></div>
        <div class="btn-row"><button class="btn" id="exam-submit-btn">Corriger mon examen</button></div>
        <div id="exam-result"></div>
        <div id="attempts-history" class="attempts-history"></div>
      </div>
      <div id="next-module-card"></div>
    </section>

    <footer class="foot">${cfg.footerHtml||''}</footer>
  </div>
  `;

  /* ---- navigation ---- */
  function goTo(view){
    root.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    root.querySelector('#view-'+view).classList.add('active');
    root.querySelectorAll('.step-btn').forEach(b=>b.classList.remove('active'));
    const btn = root.querySelector('.step-btn[data-view="'+view+'"]');
    if(btn) btn.classList.add('active');
    if(view !== 'theorie') stopSpeaking();
    window.scrollTo({top:0, behavior:'smooth'});
    if(view === 'exercices' && !exTabInit.flashcards){ switchExTab('flashcards'); }
    refreshUI();
  }
  root.querySelectorAll('.step-btn').forEach(b=>b.addEventListener('click', ()=>goTo(b.dataset.view)));
  root.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click', ()=>goTo(b.dataset.go)));
  root.querySelector('#reset-btn').addEventListener('click', resetProgress);

  function refreshUI(){
    root.querySelector('.step-btn[data-view="theorie"]').classList.toggle('done', state.theoryDone);
    root.querySelector('.step-btn[data-view="exercices"]').classList.toggle('done', state.exerciseDone);
    root.querySelector('.step-btn[data-view="examen"]').classList.toggle('done', hasPassed());
    renderProgressSummary();
    renderAttemptsHistory();
    renderNextModuleCard();
  }
  function renderProgressSummary(){
    const el = root.querySelector('#progress-summary');
    const pct = bestScorePct();
    el.innerHTML = `
      <span class="badge">Ma progression</span>
      <h3 style="margin-top:6px;">Etat actuel</h3>
      <ul class="clean" style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:0.93rem;">
        <li>Theorie lue en entier : ${state.theoryDone ? '<strong>oui</strong>' : 'pas encore'}</li>
        <li>Entrainement aborde : ${state.exerciseDone ? '<strong>oui</strong>' : 'pas encore'}</li>
        <li>Meilleur score a l'examen : <strong>${state.attempts.length ? pct.toFixed(0)+'%' : 'aucun essai pour le moment'}</strong> ${hasPassed() ? '(module reussi)' : ''}</li>
      </ul>`;
  }
  function renderAttemptsHistory(){
    const el = root.querySelector('#attempts-history');
    if(!state.attempts.length){ el.innerHTML=''; return; }
    let rows = state.attempts.map((a,i)=>`<tr><td>Essai ${i+1}</td><td>${a.date}</td><td>${a.pct.toFixed(0)}%</td><td>${a.pct>=(cfg.passThreshold||60)?'Reussi':'A retenter'}</td></tr>`).join('');
    el.innerHTML = `<h3>Historique de tes essais a l'examen</h3><table><tr><th></th><th>Date</th><th>Score</th><th>Resultat</th></tr>${rows}</table>`;
  }
  function renderNextModuleCard(){
    const el = root.querySelector('#next-module-card');
    if(!cfg.nextHref){
      if(hasPassed()){
        setModulePassed(cfg.id, bestScorePct());
        el.innerHTML = `<div class="unlock-card">
          <h3 style="margin-top:0;">Parcours termine, felicitations !</h3>
          <p>Tu as reussi le dernier module du programme de 5e et 6e annees. Retourne a l'accueil pour revoir l'ensemble de ton parcours.</p>
          <div class="btn-row" style="justify-content:center;"><a class="btn" href="${cfg.hubHref || 'index.html'}" style="text-decoration:none;">Retour a l'accueil</a></div>
        </div>`;
      } else {
        el.innerHTML = '';
      }
      return;
    }
    if(hasPassed()){
      setModulePassed(cfg.id, bestScorePct());
      el.innerHTML = `<div class="unlock-card">
        <h3 style="margin-top:0;">Module suivant debloque : ${cfg.nextTitle}</h3>
        <p>Bravo, tu peux continuer.</p>
        <div class="btn-row" style="justify-content:center;"><a class="btn" href="${cfg.nextHref}" style="text-decoration:none;">Aller au module suivant</a></div>
      </div>`;
    } else {
      el.innerHTML = `<div class="lock-card">Module suivant verrouille. Il se debloquera des que tu auras obtenu au moins ${cfg.passThreshold||60}% a cet examen.</div>`;
    }
  }
  function resetProgress(){
    if(!confirm("Effacer toute ta progression sur ce module (theorie, entrainement, essais d'examen) ? Cette action est irreversible.")) return;
    state = { theoryDone:false, exerciseDone:false, theoryStepSeen:0, attempts:[] };
    saveState();
    buildExercises(); buildExam();
    theoryIndex = 0; renderTheorySlide();
    refreshUI();
    goTo('accueil');
  }
  function markExerciseDone(){
    const wasDone = state.exerciseDone;
    state.exerciseDone = true; saveState();
    if(!wasDone) sendTelemetry(cfg.id, 'exercise_done', {});
  }

  /* ---- theorie ---- */
  let theoryIndex = 0;
  function renderTheorySlide(){
    const s = cfg.theorySlides[theoryIndex];
    root.querySelector('#theory-slides').innerHTML = `<h2>${s.title}</h2>${s.html}`;
    root.querySelector('#theory-progress-label').textContent = `Section ${theoryIndex+1} / ${cfg.theorySlides.length}`;
    root.querySelector('#theory-prev').disabled = theoryIndex === 0;
    root.querySelector('#theory-next').textContent = (theoryIndex === cfg.theorySlides.length - 1) ? 'Terminer la theorie' : 'Suivant';
    if(s.postRender) s.postRender();
    resetHelpBubble();
  }

  /* ---- bulle d'aide : tuteur IA scope a la section de theorie ---- */
  let helpLog = [];
  function escapeHtml(str){
    return (str||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
  }
  function currentTheorySectionText(){
    const s = cfg.theorySlides[theoryIndex];
    const tmp = document.createElement('div');
    tmp.innerHTML = s.html;
    return { title: s.title, text: tmp.textContent.replace(/\s+/g,' ').trim().slice(0, 6000) };
  }
  function resetHelpBubble(){
    helpLog = [];
    stopSpeaking();
    renderHelpLog();
  }
  function renderHelpLog(){
    const el = root.querySelector('#theory-help-log');
    if(!el) return;
    el.innerHTML = helpLog.map(function(turn, idx){
      let html = '<div class="theory-help-q">'+escapeHtml(turn.q)+'</div>';
      if(turn.loading) html += '<div class="theory-help-a loading">Le tuteur reflechit...</div>';
      else if(turn.error) html += '<div class="theory-help-a error">'+escapeHtml(turn.error)+'</div>';
      else html += '<div class="theory-help-a"><span class="theory-help-a-text">'+escapeHtml(turn.a)+'</span><button class="theory-help-speak" type="button" data-turn="'+idx+'" title="Ecouter la reponse">🔊</button></div>';
      return html;
    }).join('');
    el.scrollTop = el.scrollHeight;
  }
  async function askTheoryHelp(question){
    const section = currentTheorySectionText();
    const turn = { q: question, loading: true };
    helpLog.push(turn);
    renderHelpLog();
    try{
      const res = await fetch(TELEMETRY_URL.replace('/event','/ask'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: TELEMETRY_KEY, course: TELEMETRY_COURSE, moduleId: cfg.id, sectionTitle: section.title, sectionText: section.text, question: question })
      });
      const data = await res.json();
      turn.loading = false;
      if(data.answer){ turn.a = data.answer; speakText(turn.a); }
      else turn.error = data.error || "Le tuteur n'est pas disponible pour le moment.";
    }catch(e){
      turn.loading = false;
      turn.error = "Le tuteur n'est pas disponible pour le moment (verifie ta connexion).";
    }
    renderHelpLog();
  }
  function submitHelpQuestion(){
    const input = root.querySelector('#theory-help-input');
    const q = input.value.trim();
    if(!q) return;
    input.value = '';
    stopSpeaking();
    askTheoryHelp(q);
  }
  root.querySelector('#theory-help-toggle').addEventListener('click', function(){
    const panel = root.querySelector('#theory-help-panel');
    panel.hidden = !panel.hidden;
    if(!panel.hidden) root.querySelector('#theory-help-input').focus();
    else stopSpeaking();
  });
  root.querySelector('#theory-help-close').addEventListener('click', function(){
    root.querySelector('#theory-help-panel').hidden = true;
    stopSpeaking();
  });
  root.querySelector('#theory-help-send').addEventListener('click', submitHelpQuestion);
  root.querySelector('#theory-help-input').addEventListener('keydown', function(e){ if(e.key==='Enter') submitHelpQuestion(); });
  root.querySelector('#theory-help-log').addEventListener('click', function(e){
    const btn = e.target.closest('.theory-help-speak');
    if(!btn) return;
    const turn = helpLog[parseInt(btn.dataset.turn, 10)];
    if(turn && turn.a) speakText(turn.a);
  });

  function theoryStep(delta){
    if(delta > 0 && theoryIndex === cfg.theorySlides.length - 1){
      const wasDone = state.theoryDone;
      state.theoryDone = true; saveState();
      if(!wasDone) sendTelemetry(cfg.id, 'theory_done', {});
      refreshUI(); goTo('exercices'); return;
    }
    theoryIndex = Math.max(0, Math.min(cfg.theorySlides.length - 1, theoryIndex + delta));
    if(theoryIndex+1 > (state.theoryStepSeen||0)){ state.theoryStepSeen = theoryIndex+1; saveState(); }
    renderTheorySlide();
    window.scrollTo({top:0, behavior:'smooth'});
  }
  root.querySelector('#theory-prev').addEventListener('click', ()=>theoryStep(-1));
  root.querySelector('#theory-next').addEventListener('click', ()=>theoryStep(1));

  /* ---- sous-nav entrainement ---- */
  let exTabInit = { flashcards:false, jeu:false, quiz:false };
  function switchExTab(tab){
    ['flashcards','jeu','quiz'].forEach(t=>{
      root.querySelector('#subnav-'+t).classList.toggle('active', t===tab);
      root.querySelector('#ex-tab-'+t).classList.toggle('active', t===tab);
    });
    if(tab==='flashcards' && !exTabInit.flashcards){ startFlashcards(); exTabInit.flashcards = true; }
    if(tab==='jeu' && !exTabInit.jeu){ startGame(); exTabInit.jeu = true; }
    if(tab==='quiz' && !exTabInit.quiz){ buildExercises(); exTabInit.quiz = true; }
  }
  root.querySelector('#subnav-flashcards').addEventListener('click', ()=>switchExTab('flashcards'));
  root.querySelector('#subnav-jeu').addEventListener('click', ()=>switchExTab('jeu'));
  root.querySelector('#subnav-quiz').addEventListener('click', ()=>switchExTab('quiz'));
  root.querySelector('#ex-done-btn').addEventListener('click', ()=>{ markExerciseDone(); goTo('examen'); });

  /* ---- flashcards ---- */
  let fcDeck = [], fcFlipped = false;
  function startFlashcards(){
    fcDeck = cfg.flashcardBank.map((c,i)=>({...c, id:i}));
    fcFlipped = false;
    renderFlashcard();
  }
  function renderFlashcard(){
    const el = root.querySelector('#flashcards-area');
    if(!fcDeck.length){
      el.innerHTML = `<div class="unlock-card"><strong>Toutes les cartes sont maitrisees pour ce tour.</strong><div class="btn-row" style="justify-content:center;"><button class="btn" id="fc-restart">Recommencer le paquet</button></div></div>`;
      el.querySelector('#fc-restart').addEventListener('click', startFlashcards);
      return;
    }
    const card = fcDeck[0];
    el.innerHTML = `
      <div class="flashcard-progress">Cartes restantes a maitriser : ${fcDeck.length} / ${cfg.flashcardBank.length}</div>
      <div class="flashcard ${fcFlipped?'flipped':''}" id="fc-card">
        <div class="flashcard-inner">
          <div class="flashcard-face front">${card.front}</div>
          <div class="flashcard-face back">${card.back}</div>
        </div>
      </div>
      <div class="fc-controls"><button class="btn secondary" id="fc-flip">Retourner la carte</button></div>
      <div class="fc-controls">
        <button class="btn know" id="fc-know">Je savais</button>
        <button class="btn review" id="fc-review">A revoir</button>
      </div>`;
    el.querySelector('#fc-card').addEventListener('click', flipCard);
    el.querySelector('#fc-flip').addEventListener('click', flipCard);
    el.querySelector('#fc-know').addEventListener('click', ()=>fcRate(true));
    el.querySelector('#fc-review').addEventListener('click', ()=>fcRate(false));
  }
  function flipCard(){ fcFlipped = !fcFlipped; renderFlashcard(); }
  function fcRate(knew){
    const card = fcDeck.shift();
    if(!knew) fcDeck.push(card);
    fcFlipped = false;
    markExerciseDone();
    renderFlashcard();
  }

  /* ============================================================
     JEU : trois mecaniques possibles selon cfg.game.type
     ============================================================ */
  let chronoTimer = null;
  function startGame(){
    const g = cfg.game;
    if(!g){ root.querySelector('#game-area').innerHTML = ''; return; }
    if(g.type === 'chrono') startChronoGame(g);
    else if(g.type === 'order') startOrderGame(g);
    else if(g.type === 'match') startMatchGame(g);
  }

  /* --- Chrono : calcul rapide, temps limite global --- */
  function startChronoGame(g){
    let items = shuffleArray(g.items.slice());
    let idx = 0, score = 0, timeLeft = g.duration || 60;
    const el = root.querySelector('#game-area');
    function render(){
      if(timeLeft <= 0 || idx >= items.length){
        clearInterval(chronoTimer);
        el.innerHTML = `<div class="score-box"><div>Score</div><div class="score-number pass">${score} / ${idx}</div>
          <p style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:0.85rem; color:var(--ink-soft);">${idx < items.length ? "Temps ecoule !" : "Serie terminee !"}</p>
          <div class="btn-row" style="justify-content:center;"><button class="btn" id="game-restart">Rejouer</button></div></div>`;
        el.querySelector('#game-restart').addEventListener('click', startGame);
        markExerciseDone();
        return;
      }
      const item = items[idx];
      el.innerHTML = `
        <div class="chrono-timer ${timeLeft<=10?'low':''}" id="chrono-time">${timeLeft} s</div>
        <div class="game-score">Question ${idx+1} / ${items.length} &middot; score : ${score}</div>
        <div class="chrono-prompt">${item.prompt}</div>
        <div style="text-align:center;"><input class="text-answer" id="chrono-input" type="text" autocomplete="off" placeholder="Ta reponse"></div>
        <div class="btn-row" style="justify-content:center;"><button class="btn" id="chrono-submit">Valider</button></div>
        <div id="chrono-feedback" class="feedback" style="text-align:center;"></div>
      `;
      const input = el.querySelector('#chrono-input');
      input.focus();
      function submit(){
        const ok = numericMatches(input.value, item.accepted, item.tolerance);
        if(ok) score++;
        idx++;
        render();
      }
      el.querySelector('#chrono-submit').addEventListener('click', submit);
      input.addEventListener('keydown', e=>{ if(e.key==='Enter') submit(); });
    }
    render();
    clearInterval(chronoTimer);
    chronoTimer = setInterval(()=>{
      timeLeft--;
      const t = root.querySelector('#chrono-time');
      if(t){ t.textContent = timeLeft+' s'; t.classList.toggle('low', timeLeft<=10); }
      if(timeLeft <= 0){ render(); }
    }, 1000);
  }

  /* --- Ordre : remettre des etapes dans l'ordre --- */
  function startOrderGame(g){
    let challenges = g.challenges.slice();
    let idx = 0, score = 0;
    const el = root.querySelector('#game-area');
    function render(){
      if(idx >= challenges.length){
        el.innerHTML = `<div class="score-box"><div>Score</div><div class="score-number pass">${score} / ${challenges.length}</div>
          <div class="btn-row" style="justify-content:center;"><button class="btn" id="game-restart">Rejouer</button></div></div>`;
        el.querySelector('#game-restart').addEventListener('click', startGame);
        markExerciseDone();
        return;
      }
      const ch = challenges[idx];
      let order = shuffleArray(ch.steps.map((s,i)=>i));
      function renderList(){
        el.innerHTML = `
          <div class="game-score">Defi ${idx+1} / ${challenges.length} &middot; score : ${score}</div>
          <div class="q-prompt">${ch.prompt}</div>
          <ul class="order-list" id="order-list"></ul>
          <div class="btn-row"><button class="btn" id="order-check">Verifier l'ordre</button></div>
          <div id="order-feedback" class="feedback"></div>
        `;
        const list = el.querySelector('#order-list');
        order.forEach((stepIdx, pos)=>{
          const li = document.createElement('li');
          li.innerHTML = `<span class="step-text">${ch.steps[stepIdx]}</span>
            <span class="step-controls">
              <button data-dir="up" ${pos===0?'disabled':''}>&uarr;</button>
              <button data-dir="down" ${pos===order.length-1?'disabled':''}>&darr;</button>
            </span>`;
          list.appendChild(li);
          li.querySelector('[data-dir="up"]').addEventListener('click', ()=>{ if(pos>0){ [order[pos-1],order[pos]]=[order[pos],order[pos-1]]; renderList(); } });
          li.querySelector('[data-dir="down"]').addEventListener('click', ()=>{ if(pos<order.length-1){ [order[pos+1],order[pos]]=[order[pos],order[pos+1]]; renderList(); } });
        });
        el.querySelector('#order-check').addEventListener('click', ()=>{
          const ok = order.every((v,i)=>v===i);
          if(ok) score++;
          const fb = el.querySelector('#order-feedback');
          fb.className = 'feedback show ' + (ok?'correct':'incorrect');
          fb.innerHTML = (ok ? "Bravo, c'est le bon ordre !" : "Ce n'est pas encore le bon ordre.") +
            ' <div class="btn-row"><button class="btn" id="order-next">Defi suivant</button></div>';
          fb.querySelector('#order-next').addEventListener('click', ()=>{ idx++; render(); });
        });
      }
      renderList();
    }
    render();
  }

  /* --- Association : reprend le rendu "match" du quiz --- */
  function startMatchGame(g){
    const el = root.querySelector('#game-area');
    el.innerHTML = `
      <p style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:0.88rem; color:var(--ink-soft);">${g.instructions||''}</p>
      <div class="q-prompt">${g.prompt}</div>
      ${renderMatch(g, 0, 'gamematch')}
      <div class="btn-row"><button class="btn" id="match-check">Verifier</button></div>
      <div id="match-feedback" class="feedback"></div>
    `;
    el.querySelector('#match-check').addEventListener('click', ()=>{
      let good = 0;
      g.items.forEach((item,j)=>{
        const sel = document.getElementById(`gamematch-0-${j}`);
        if(sel && sel.value === item.correct) good++;
      });
      const fb = el.querySelector('#match-feedback');
      const ok = good === g.items.length;
      fb.className = 'feedback show ' + (ok?'correct':(good>0?'partial':'incorrect'));
      fb.textContent = `${good} / ${g.items.length} associations correctes.`;
      markExerciseDone();
    });
  }

  function shuffleArray(arr){
    for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    return arr;
  }

  /* ---- quiz ---- */
  function buildExercises(){
    const container = root.querySelector('#exercices-list');
    container.innerHTML = cfg.exerciseBank.map((q, idx)=>`
      <div class="question">
        <div class="q-number">Exercice ${idx+1} <span class="q-points">(${q.points} pt${q.points>1?'s':''})</span></div>
        <div class="q-prompt">${q.prompt}</div>
        ${renderQuestionBody(q, idx, 'ex')}
        <button class="check-btn" data-idx="${idx}">Verifier ma reponse</button>
        <div class="feedback" id="ex-feedback-${idx}"></div>
      </div>`).join('');
    container.querySelectorAll('.check-btn').forEach(b=>b.addEventListener('click', ()=>checkExercise(parseInt(b.dataset.idx,10))));
  }
  function checkExercise(idx){
    const q = cfg.exerciseBank[idx];
    const {earned, detail} = gradeQuestion(q, idx, 'ex');
    const pct = earned / q.points;
    const el = root.querySelector(`#ex-feedback-${idx}`);
    el.className = 'feedback show ' + (pct>=0.99 ? 'correct' : (pct>0 ? 'partial' : 'incorrect'));
    let html = `<strong>${earned} / ${q.points} pt(s).</strong> ${q.explain}`;
    if(q.type==='data' || q.type==='match' || q.type==='classify') html += ` ${detail}`;
    if(q.type==='numeric') html += ` ${detail}`;
    if(q.modelAnswer) html += `<div class="model">Corrige-modele : "${q.modelAnswer}"</div>`;
    el.innerHTML = html;
    markExerciseDone();
  }

  /* ---- examen ---- */
  function buildExam(){
    const container = root.querySelector('#exam-questions');
    container.innerHTML = cfg.examBank.map((q, idx)=>`
      <div class="question">
        <div class="q-number">Question ${idx+1} <span class="q-points">(${q.points} pt${q.points>1?'s':''})</span></div>
        <div class="q-prompt">${q.prompt}</div>
        ${renderQuestionBody(q, idx, 'exam')}
      </div>`).join('');
    root.querySelector('#exam-result').innerHTML = '';
  }
  function submitExam(){
    let total = 0, earnedTotal = 0, breakdown = [];
    cfg.examBank.forEach((q, idx)=>{
      total += q.points;
      const {earned, detail} = gradeQuestion(q, idx, 'exam');
      earnedTotal += earned;
      breakdown.push({idx, q, earned, detail});
    });
    const pct = (earnedTotal/total)*100;
    const passed = pct >= (cfg.passThreshold||60);
    state.attempts.push({ date: new Date().toLocaleDateString('fr-BE'), pct: pct });
    saveState();
    if(passed) setModulePassed(cfg.id, pct);
    sendTelemetry(cfg.id, 'exam_attempt', { pct: pct });

    let html = `<div class="score-box"><div>Ton score</div><div class="score-number ${passed?'pass':'fail'}">${pct.toFixed(0)}%</div>
      <div>${earnedTotal.toFixed(1)} / ${total} points</div>
      <div class="badge ${passed?'':'warn'}" style="margin-top:10px;">${passed ? 'Module reussi (seuil de '+(cfg.passThreshold||60)+'% atteint)' : 'Pas encore '+(cfg.passThreshold||60)+'%, tu peux retenter'}</div></div>`;
    html += breakdown.map(b=>`
      <div class="question">
        <div class="q-number">Question ${b.idx+1}</div>
        <div class="q-prompt">${b.q.prompt}</div>
        <div class="feedback show ${b.earned>=b.q.points-0.01?'correct':(b.earned>0?'partial':'incorrect')}">
          <strong>${b.earned.toFixed(1)} / ${b.q.points} pt(s).</strong>
          ${b.q.type==='mcq' ? 'Reponse attendue : '+b.q.options[b.q.correct]+'.' : ''}
          ${b.q.type==='tf' ? 'Reponse attendue : '+(b.q.correct?'Vrai':'Faux')+'.' : ''}
          ${b.q.type==='numeric' ? 'Reponse attendue : '+(b.q.acceptedDisplay || b.q.accepted.join(' ou '))+'.' : ''}
          ${(b.q.type==='match'||b.q.type==='classify'||b.q.type==='data'||b.q.type==='open') ? b.detail : ''}
          ${b.q.modelAnswer ? '<div class="model">Corrige-modele : "'+b.q.modelAnswer+'"</div>' : ''}
        </div>
      </div>`).join('');
    root.querySelector('#exam-result').innerHTML = html;
    refreshUI();
    root.querySelector('#exam-result').scrollIntoView({behavior:'smooth'});
  }
  root.querySelector('#exam-submit-btn').addEventListener('click', submitExam);

  /* ---- init ---- */
  theoryIndex = 0;
  renderTheorySlide();
  buildExam();
  refreshUI();
  goTo('accueil');
  startHeartbeat(cfg.id);
}

window.MathEngine = { initModule, getModuleStatus };
})();

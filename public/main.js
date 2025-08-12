import { Minesweeper, randomizeColorfulPalette } from './game.js';
import { initAuthUI, refreshAuthUI, triggerSignin, showGame } from './auth.js';
import { fetchLeaderboard, submitScore } from './api.js';

const el = (sel) => document.querySelector(sel);
const els = (sel) => Array.from(document.querySelectorAll(sel));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const board = el('#board');
let game;

const MODE_CONFIG = {
  beginner: {w:8,h:8,mines:10},
  intermediate: {w:12,h:10,mines:22},
  expert: {w:16,h:12,mines:40}
};

function applyMode(mode){
  const cfg = MODE_CONFIG[mode];
  if(!cfg){ console.error('Unknown mode', mode); return; }
  const y = window.scrollY;
  els('.mode-btn').forEach(b=> b.setAttribute('aria-pressed', String(b.dataset.mode===mode)) );
  if(document.body.classList.contains('theme-colorful')) { randomizeColorfulPalette(); }
  game.newGame(cfg);
  window.scrollTo(0, y);
  el('#lbMode').value = mode;
  refreshLeaderboard();
}

function setLightPalette(){
  const root = document.documentElement.style;
  root.setProperty('--cell-unrevealed', '#e7ecff');
  root.setProperty('--cell-unrevealed-top', '#eef2ff');
  root.setProperty('--cell-revealed-edge', '#c7d2fe');
  root.setProperty('--panel-2', '#f1f5ff');
  root.setProperty('--n1', '#2563eb');
  root.setProperty('--n2', '#16a34a');
  root.setProperty('--n3', '#dc2626');
  root.setProperty('--n4', '#7c3aed');
}

function applyTheme(theme){
  document.body.classList.remove('theme-light','theme-dark','theme-colorful');
  if(theme==='dark'){
    document.body.classList.add('theme-dark');
  } else if(theme==='colorful') {
    document.body.classList.add('theme-colorful');
    randomizeColorfulPalette();
  } else {
    document.body.classList.add('theme-light');
    setLightPalette();
  }
  els('.theme-btn').forEach(b=> b.setAttribute('aria-pressed', String(b.dataset.theme===theme)) );
  if(game && game._draw) game._draw();
}

function fireConfetti(duration=1500, count=120){
  try{
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    Object.assign(canvas.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:9999});
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const parts = Array.from({length:count}, ()=>({
      x: Math.random()*W,
      y: -20 - Math.random()*H,
      r: 3 + Math.random()*4,
      vx: -1 + Math.random()*2,
      vy: 2 + Math.random()*3,
      color: `hsl(${Math.random()*360} 80% 60%)`
    }));
    let start=null;
    function tick(ts){
      if(!start) start = ts;
      const t = ts - start;
      ctx.clearRect(0,0,W,H);
      for(const p of parts){ p.x += p.vx; p.y += p.vy; p.vy += 0.02; ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); }
      if(t < duration){ requestAnimationFrame(tick); } else { canvas.remove(); }
    }
    requestAnimationFrame(tick);
    const onResize = ()=>{ W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener('resize', onResize, {once:true});
  }catch(err){ console.warn('Confetti unavailable:', err); }
}

function showModal(title, text){ el('#modalTitle').textContent = title; el('#modalText').textContent = text; el('#resultModal').style.display = 'flex'; }
function hideModal(){ el('#resultModal').style.display = 'none'; }

async function onGameWin({ time, w, h, mines }){
  fireConfetti(1800, 140);
  showModal('Cleared!', `No mines hit. Cleared in ${time}s.`);
  const active = getActiveMode();
  const user = await refreshAuthUI();
  const name = user ? undefined : prompt('Enter name for leaderboard (or leave blank for Guest):', '');
  try{
    await submitScore({ mode: active, timeSeconds: time, width: w, height: h, mines, displayName: name || 'Guest' });
    refreshLeaderboard();
  }catch(e){ console.warn('Submit failed', e); }
}

function onGameLose(){ showModal('Game Over', 'You hit a mine.'); }

function getActiveMode(){ return els('.mode-btn').find(b=>b.getAttribute('aria-pressed')==='true')?.dataset.mode || 'beginner'; }

async function refreshLeaderboard(){
  const mode = el('#lbMode').value;
  const { items } = await fetchLeaderboard(mode);
  const ol = el('#leaderboardList');
  ol.innerHTML = '';
  items.forEach((row)=>{
    const li = document.createElement('li');
    const left = document.createElement('span');
    left.textContent = row.displayName || (row.isGuest ? 'Guest' : 'Player');
    const right = document.createElement('span');
    right.textContent = `${row.timeSeconds}s`;
    li.append(left, right); ol.appendChild(li);
  });
}

function initEvents(){
  els('.mode-btn').forEach(btn=>{ btn.addEventListener('click', ()=> applyMode(btn.dataset.mode)); });
  els('.theme-btn').forEach(btn=> btn.addEventListener('click', ()=> applyTheme(btn.dataset.theme)) );
  el('#reset').addEventListener('click', ()=>{ const y = window.scrollY; applyMode(getActiveMode()); window.scrollTo(0, y); });
  el('#btnAgain').addEventListener('click', ()=>{ hideModal(); el('#reset').click(); });
  el('#btnChange').addEventListener('click', ()=>{ hideModal(); });
  window.addEventListener('resize', ()=> game._render());
  const modalBackdrop = document.querySelector('#resultModal');
  if(modalBackdrop){ modalBackdrop.addEventListener('click', (e)=>{ if(e.target === modalBackdrop) hideModal(); }); }
  window.addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && modalBackdrop && modalBackdrop.style.display === 'flex') hideModal(); });
  el('#btnRefreshLb').addEventListener('click', refreshLeaderboard);
  el('#lbMode').addEventListener('change', refreshLeaderboard);
}

export function ensureGameVisible(){
  const root = document.getElementById('gameRoot');
  if(root) root.hidden = false;
  if(!game){ game = new Minesweeper(board, { onWin: onGameWin, onLose: onGameLose }); }
}

function initLanding(){
  const btnSignin = document.getElementById('landingSignin');
  const btnSkip = document.getElementById('landingSkip');
  if(btnSignin){ btnSignin.addEventListener('click', ()=> triggerSignin()); }
  if(btnSkip){ btnSkip.addEventListener('click', ()=> { showGame(); ensureGameVisible(); }); }
}

function initGame(){
  game = new Minesweeper(board, { onWin: onGameWin, onLose: onGameLose });
}

(async function init(){
  document.addEventListener('DOMContentLoaded', async ()=>{
    applyTheme('light');
    initGame();
    initEvents();
    initLanding();
    await initAuthUI();
    applyMode('beginner');
    await refreshLeaderboard();
  });
})();

window.addEventListener('game:show', ()=>{
  ensureGameVisible();
});
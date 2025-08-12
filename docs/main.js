import './polyfill.js';
import { Minesweeper, randomizeColorfulPalette } from './game.js';
import { initAuthUI, refreshAuthUI, triggerSignin } from './auth.js';
import { fetchLeaderboard, submitScore } from './api.js';

const MODES = ['beginner','intermediate','expert'];
const THEMES = ['light','dark','colorful'];

const el = (sel) => document.querySelector(sel);
const els = (sel) => Array.from(document.querySelectorAll(sel));

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
  if(document.body.classList.contains('theme-colorful')) { randomizeColorfulPalette(); }
  game.newGame(cfg);
  document.querySelector('#lbMode').value = mode;
  const btn = document.querySelector('#modeToggle'); if(btn){
    const names = {beginner:'Beginner', intermediate:'Intermediate', expert:'Expert'};
    btn.textContent = names[mode] || mode;
  }
  refreshLeaderboard();
}

function getActiveMode(){
  const toggle = document.querySelector('#modeToggle');
  if(toggle){
    const text = toggle.textContent?.toLowerCase();
    if(text?.includes('beginner')) return 'beginner';
    if(text?.includes('intermediate')) return 'intermediate';
    if(text?.includes('expert')) return 'expert';
  }
  return 'beginner';
}

function initToggleControls(){
  const modeBtn = document.querySelector('#modeToggle');
  if(modeBtn){
    modeBtn.addEventListener('click', ()=>{
      const current = getActiveMode();
      const idx = MODES.indexOf(current);
      const next = MODES[(idx+1)%MODES.length] || 'beginner';
      applyMode(next);
    });
  }
  const themeBtn = document.querySelector('#themeToggle');
  if(themeBtn){
    themeBtn.addEventListener('click', ()=>{
      const current = document.body.classList.contains('theme-dark') ? 'dark' : (document.body.classList.contains('theme-colorful') ? 'colorful' : 'light');
      const idx = THEMES.indexOf(current);
      const next = THEMES[(idx+1)%THEMES.length] || 'light';
      applyTheme(next);
      themeBtn.textContent = next.charAt(0).toUpperCase()+next.slice(1);
    });
  }
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
  const themeBtn = document.querySelector('#themeToggle'); if(themeBtn){ themeBtn.textContent = theme.charAt(0).toUpperCase()+theme.slice(1); }
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
  const active = els('.mode-btn').find(b=>b.getAttribute('aria-pressed')==='true')?.dataset.mode || 'beginner';
  const user = await refreshAuthUI();
  const name = user ? undefined : prompt('Enter name for leaderboard (or leave blank for Guest):', '');
  try{
    await submitScore({ mode: active, timeSeconds: time, width: w, height: h, mines, displayName: name || 'Guest' });
    refreshLeaderboard();
  }catch(e){ console.warn('Submit failed', e); }
}

function onGameLose(){ showModal('Game Over', 'You hit a mine.'); }

async function refreshLeaderboard(){
  const mode = document.querySelector('#lbMode').value;
  const { items } = await fetchLeaderboard(mode);
  const ol = document.querySelector('#leaderboardList');
  ol.innerHTML = '';
  items.forEach((row)=>{
    const li = document.createElement('li');
    const left = document.createElement('span');
    left.textContent = row.displayName || (row.isGuest ? 'Guest' : 'Player');
    const right = document.createElement('span');
    right.textContent = `${row.timeSeconds}s`;
    li.append(left, right); ol.appendChild(li);
  });
  const spot = document.querySelector('#bestSpotlight');
  if(spot){
    if(items && items.length){
      const best = items[0];
      spot.innerHTML = `<span>Best (${mode}): <strong>${best.displayName || (best.isGuest ? 'Guest' : 'Player')}</strong></span><span class="meta">${best.timeSeconds}s</span>`;
      spot.hidden = false;
    } else { spot.hidden = true; }
  }
}

function initEvents(){
  document.querySelector('#reset').addEventListener('click', ()=>{ const y = window.scrollY; applyMode(getActiveMode()); window.scrollTo(0, y); });
  document.querySelector('#btnAgain').addEventListener('click', ()=>{ hideModal(); document.querySelector('#reset').click(); });
  document.querySelector('#btnChange').addEventListener('click', ()=>{ hideModal(); });
  window.addEventListener('resize', ()=> game._render());
  const modalBackdrop = document.querySelector('#resultModal');
  if(modalBackdrop){ modalBackdrop.addEventListener('click', (e)=>{ if(e.target === modalBackdrop) hideModal(); }); }
  window.addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && modalBackdrop && modalBackdrop.style.display === 'flex') hideModal(); });
  document.querySelector('#btnRefreshLb').addEventListener('click', refreshLeaderboard);
  document.querySelector('#lbMode').addEventListener('change', refreshLeaderboard);
}

function initGame(){
  game = new Minesweeper(board, { onWin: onGameWin, onLose: onGameLose });
}

function initLanding(){
  const btnSignin = document.getElementById('landingSignin');
  const btnSkip = document.getElementById('landingSkip');
  if(btnSignin){ btnSignin.addEventListener('click', ()=> triggerSignin()); }
  if(btnSkip){ btnSkip.addEventListener('click', ()=> { const landing=document.getElementById('landing'); const root=document.getElementById('gameRoot'); if(landing) landing.style.display='none'; if(root) root.hidden=false; }); }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  applyTheme('light');
  initGame();
  initEvents();
  initToggleControls();
  initLanding();
  await initAuthUI();
  applyMode('beginner');
  await refreshLeaderboard();
});
export const Icon = {
  mine: () => {
    const danger = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim() || '#ef4444';
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <g fill="none" stroke="${danger}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5.5" fill="${danger}22"/>
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M19.07 4.93l-2.83 2.83M7.76 16.24l-2.83 2.83"/>
          <circle cx="10" cy="10" r="0.6" fill="${danger}"/>
          <circle cx="14" cy="10" r="0.6" fill="${danger}"/>
          <path d="M9.5 13.2c1.7 1.2 3.3 1.2 5 0"/>
        </g>
      </svg>`;
  },
  flag: () => `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 21V4m0 0h9l-2 3 2 3H6" fill="${getComputedStyle(document.documentElement).getPropertyValue('--warning').trim()}" stroke="#b45309" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`
};

export function solveDeterministically(sim){
  let changed = true; let progress = false;
  while(changed){
    changed = false;
    for(let y=0;y<sim.h;y++){
      for(let x=0;x<sim.w;x++){
        const c = sim.cells[y][x];
        if(!c.revealed || c.adj <= 0) continue;
        let hidden=[]; let flagged=0;
        for(let ny=Math.max(0,y-1); ny<=Math.min(sim.h-1,y+1); ny++){
          for(let nx=Math.max(0,x-1); nx<=Math.min(sim.w-1,x+1); nx++){
            if(nx===x && ny===y) continue;
            const n = sim.cells[ny][nx];
            if(!n.revealed && !n.flagged) hidden.push([nx,ny]);
            if(n.flagged) flagged++;
          }
        }
        if(flagged === c.adj && hidden.length){
          hidden.forEach(([sx,sy])=>{ const s=sim.cells[sy][sx]; if(!s.revealed && !s.flagged){ s.revealed=true; progress=true; changed=true; }});
        }
        if(c.adj - flagged === hidden.length && hidden.length){
          hidden.forEach(([fx,fy])=>{ const s=sim.cells[fy][fx]; if(!s.flagged){ s.flagged=true; progress=true; changed=true; }});
        }
      }
    }
  }
  for(let y=0;y<sim.h;y++) for(let x=0;x<sim.w;x++){ const c = sim.cells[y][x]; if(!c.mine && !c.revealed) return {solved:false, progress}; }
  return {solved:true, progress};
}

export function cloneBoard(src){
  const sim = {w:src.w,h:src.h,cells:[]};
  for(let y=0;y<src.h;y++){
    sim.cells[y] = [];
    for(let x=0;x<src.w;x++){
      const c = src.cells[y][x];
      sim.cells[y][x] = {mine:c.mine, adj:c.adj, revealed:c.revealed, flagged:c.flagged};
    }
  }
  return sim;
}

export class Minesweeper {
  constructor(boardEl, { onWin, onLose } = {}){
    this.boardEl = boardEl;
    this.timer = null; this.time = 0;
    this.firstReveal = true; this.ended = false;
    this.cells = []; this.w = 9; this.h = 9; this.mines = 10;
    this.onWin = onWin; this.onLose = onLose;
    this._bindGlobalContextMenu();
  }
  newGame({w,h,mines}){
    const y = window.scrollY;
    if(document.body.classList.contains('theme-colorful')) randomizeColorfulPalette();
    this.w = w; this.h = h; this.mines = Math.min(mines, w*h-1);
    this.firstReveal = true; this.ended = false; this.time = 0; this._stopTimer(); this._updateTime();
    this._buildEmpty(); this._render(); this._updateCounts();
    window.scrollTo(0, y);
  }
  _buildEmpty(){ this.cells = Array.from({length:this.h}, () => Array.from({length:this.w}, () => ({ mine:false, adj:0, revealed:false, flagged:false }))); }
  _placeMinesNoGuess(excludeX, excludeY){
    const MAX_TRIES = 300;
    for(let attempt=0; attempt<MAX_TRIES; attempt++){
      this.cells.forEach(row=>row.forEach(c=>{c.mine=false; c.adj=0; c.revealed=false; c.flagged=false;}));
      let placed = 0; while(placed < this.mines){
        const x = Math.floor(Math.random()*this.w);
        const y = Math.floor(Math.random()*this.h);
        if ((x===excludeX && y===excludeY) || this.cells[y][x].mine) continue;
        this.cells[y][x].mine = true; placed++;
      }
      for(let y=0;y<this.h;y++){
        for(let x=0;x<this.w;x++){
          if (this.cells[y][x].mine) { this.cells[y][x].adj = -1; continue; }
          let c=0; this._forEachNeighbor(x,y,(nx,ny)=>{ if(this.cells[ny][nx].mine) c++; });
          this.cells[y][x].adj = c;
        }
      }
      const sim = cloneBoard(this);
      if(sim.cells[excludeY][excludeX].mine) continue;
      const stack=[[excludeX,excludeY]]; const visited=new Set();
      while(stack.length){
        const [cx,cy]=stack.pop(); const key=cx+','+cy; if(visited.has(key)) continue; visited.add(key);
        const c=sim.cells[cy][cx]; c.revealed=true;
        if(c.adj===0){ this._forEachNeighbor(cx,cy,(nx,ny)=>{ const n=sim.cells[ny][nx]; if(!n.revealed && !n.flagged && !n.mine) stack.push([nx,ny]); }); }
      }
      const res = solveDeterministically(sim);
      if(res.solved){ return true; }
    }
    return false;
  }
  _placeMines(excludeX, excludeY){
    if(this._placeMinesNoGuess(excludeX, excludeY)) return;
    let placed = 0; const total = this.mines;
    while(placed < total){
      const x = Math.floor(Math.random()*this.w);
      const y = Math.floor(Math.random()*this.h);
      if ((x===excludeX && y===excludeY) || this.cells[y][x].mine) continue;
      this.cells[y][x].mine = true; placed++;
    }
    for(let y=0;y<this.h;y++){
      for(let x=0;x<this.w;x++){
        if (this.cells[y][x].mine) { this.cells[y][x].adj = -1; continue; }
        let c=0; this._forEachNeighbor(x,y,(nx,ny)=>{ if(this.cells[ny][nx].mine) c++; });
        this.cells[y][x].adj = c;
      }
    }
  }
  _forEachNeighbor(x,y,cb){
    for(let dy=-1; dy<=1; dy++){
      for(let dx=-1; dx<=1; dx++){
        if(dx===0 && dy===0) continue;
        const nx=x+dx, ny=y+dy;
        if(nx>=0 && nx<this.w && ny>=0 && ny<this.h) cb(nx,ny);
      }
    }
  }
  _render(){
    const sizePx = this._cellSize();
    this.boardEl.style.gridTemplateColumns = `repeat(${this.w}, ${sizePx}px)`;
    this.boardEl.innerHTML = '';
    for(let y=0;y<this.h;y++){
      for(let x=0;x<this.w;x++){
        const div = document.createElement('div');
        div.className = 'cell hidden';
        div.dataset.x = String(x); div.dataset.y = String(y);
        div.addEventListener('click', (e)=> this._onLeftClick(e, x, y));
        div.addEventListener('contextmenu', (e)=> this._onRightClick(e, x, y));
        this.boardEl.appendChild(div);
      }
    }
    this._draw();
  }
  _cellSize(){
    const maxW = Math.min(900, window.innerWidth*0.9 - 40);
    const cell = Math.floor(maxW / this.w) - 2;
    return Math.max(22, Math.min(38, cell));
  }
  _inBounds(x,y){ return x>=0 && x<this.w && y>=0 && y<this.h; }
  _onLeftClick(e, x, y){
    if(this.ended) return;
    if(!this._inBounds(x,y)) return;
    const cell = this.cells[y] && this.cells[y][x];
    if(!cell) return;
    if(cell.flagged || cell.revealed) return;
    if(this.firstReveal){ this._placeMines(x,y); this.firstReveal = false; this._startTimer(); }
    if(cell.mine){ this._revealAll(); this.ended = true; this._stopTimer(); this._draw(); if(this.onLose) this.onLose({ time:this.time }); return; }
    this._reveal(x,y); this._draw();
    if(this._checkWin()){
      this.ended = true; this._stopTimer();
      if(this.onWin) this.onWin({ time:this.time, w:this.w, h:this.h, mines:this.mines });
    }
  }
  _onRightClick(e, x, y){ e.preventDefault(); if(this.ended) return; if(!this._inBounds(x,y)) return; const cell = this.cells[y] && this.cells[y][x]; if(!cell || cell.revealed) return; cell.flagged = !cell.flagged; this._updateCounts(); this._drawCell(x,y); }
  _reveal(x,y){
    const stack=[[x,y]]; const visited=new Set();
    while(stack.length){
      const [cx,cy] = stack.pop();
      if(!this._inBounds(cx,cy)) continue;
      const key = cx+','+cy; if(visited.has(key)) continue; visited.add(key);
      const c = this.cells[cy] && this.cells[cy][cx];
      if(!c || c.flagged || c.revealed) continue; c.revealed = true;
      if(c.adj===0){ this._forEachNeighbor(cx,cy,(nx,ny)=>{ const n = this.cells[ny][nx]; if(!n.revealed && !n.flagged && !n.mine) stack.push([nx,ny]); }); }
    }
  }
  _revealAll(){ for(let y=0;y<this.h;y++){ for(let x=0;x<this.w;x++){ this.cells[y][x].revealed = true; } } }
  _checkWin(){ for(let y=0;y<this.h;y++){ for(let x=0;x<this.w;x++){ const c=this.cells[y][x]; if(!c.mine && !c.revealed) return false; } } return true; }
  _updateCounts(){
    let flagsUsed = 0;
    for(let y=0;y<this.h;y++) for(let x=0;x<this.w;x++){ if(this.cells[y][x].flagged) flagsUsed++; }
    document.querySelector('#mineCount').textContent = String(this.mines).padStart(3,'0');
    document.querySelector('#flagsLeft').textContent = String(Math.max(0, this.mines - flagsUsed)).padStart(3,'0');
  }
  _startTimer(){ if(this.timer) return; this.timer = setInterval(()=>{ this.time++; this._updateTime(); }, 1000); }
  _stopTimer(){ if(this.timer){ clearInterval(this.timer); this.timer=null; } }
  _updateTime(){ document.querySelector('#time').textContent = String(this.time).padStart(3,'0'); }
  _draw(){ for(let y=0;y<this.h;y++){ for(let x=0;x<this.w;x++) this._drawCell(x,y); } }
  _drawCell(x,y){
    const idx = y*this.w + x; const div = this.boardEl.children[idx];
    if(!div) return;
    const c = this.cells[y][x];
    div.className = 'cell ' + (c.revealed ? 'revealed' : 'hidden') + (c.flagged ? ' flagged' : '') + (c.mine && c.revealed ? ' mine' : '');
    if(c.revealed){
      if(c.mine){ div.innerHTML = Icon.mine(); }
      else if(c.adj>0){ div.textContent = c.adj; div.classList.add('n'+c.adj); }
      else { div.textContent = ''; }
    } else { div.innerHTML = c.flagged ? Icon.flag() : ''; }
  }
  _bindGlobalContextMenu(){ this.boardEl.addEventListener('contextmenu',(e)=>{ e.preventDefault(); }); }
}

export function hsl(h,s,l){return `hsl(${h} ${s}% ${l}%)`}
export function random(min,max){return Math.floor(Math.random()*(max-min+1))+min}
export function randomizeColorfulPalette(){
  const base = random(0,359);
  const panelTint = (base+320)%360;
  const root = document.documentElement.style;
  root.setProperty('--cell-unrevealed', hsl(panelTint, 95, 92));
  root.setProperty('--cell-unrevealed-top', hsl(panelTint, 100, 96));
  root.setProperty('--cell-revealed-edge', hsl(panelTint, 60, 70));
  root.setProperty('--panel-2', hsl(panelTint, 60, 96));
  root.setProperty('--n1', hsl((base+0)%360, 70, 40));
  root.setProperty('--n2', hsl((base+100)%360, 60, 38));
  root.setProperty('--n3', hsl((base+200)%360, 65, 40));
  root.setProperty('--n4', hsl((base+280)%360, 55, 45));
}
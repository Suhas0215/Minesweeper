const API_BASE = window.API_BASE || '';

export async function getConfig(){
  const res = await fetch(`${API_BASE}/api/config`);
  return res.json();
}

export async function getSession(){
  const res = await fetch(`${API_BASE}/api/session`, { credentials: 'include' });
  return res.json();
}

export async function logout(){
  await fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' });
}

export async function googleLoginWithIdToken(idToken){
  const res = await fetch(`${API_BASE}/api/auth/google`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken })
  });
  if(!res.ok) throw new Error('Login failed');
  return res.json();
}

export async function fetchLeaderboard(mode){
  const res = await fetch(`${API_BASE}/api/leaderboard?mode=${encodeURIComponent(mode)}`, { credentials: 'include' });
  return res.json();
}

export async function submitScore({ mode, timeSeconds, width, height, mines, displayName }){
  const res = await fetch(`${API_BASE}/api/score`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ mode, timeSeconds, width, height, mines, displayName })
  });
  return res.json();
}
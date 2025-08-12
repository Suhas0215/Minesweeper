export async function getConfig(){
  const res = await fetch('/api/config');
  return res.json();
}

export async function getSession(){
  const res = await fetch('/api/session');
  return res.json();
}

export async function logout(){
  await fetch('/api/logout', { method: 'POST' });
}

export async function googleLoginWithIdToken(idToken){
  const res = await fetch('/api/auth/google', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  if(!res.ok) throw new Error('Login failed');
  return res.json();
}

export async function fetchLeaderboard(mode){
  const res = await fetch(`/api/leaderboard?mode=${encodeURIComponent(mode)}`);
  return res.json();
}

export async function submitScore({ mode, timeSeconds, width, height, mines, displayName }){
  const res = await fetch('/api/score', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, timeSeconds, width, height, mines, displayName })
  });
  return res.json();
}
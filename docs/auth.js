import { getConfig, getSession, googleLoginWithIdToken, logout } from './api.js';

let googleClientId = '';
let gisReady = false;
let gisInitialized = false;

export async function initAuthUI(){
  const { googleClientId: cid } = await getConfig();
  googleClientId = cid || '';
  if(googleClientId){
    await loadGisScript();
    gisReady = true;
  }
  await refreshAuthUI();
  const btn = document.querySelector('#btnSignin');
  if(btn){ btn.addEventListener('click', triggerSignin); }
  const btnLogout = document.querySelector('#btnLogout');
  if(btnLogout){ btnLogout.addEventListener('click', async ()=>{ await logout(); await refreshAuthUI(); }); }
  // Expose for landing to call if needed
  window.triggerSignin = triggerSignin;
}

export function triggerSignin(){
  if(!gisReady){ alert('Google login is not configured. You can still play and submit as Guest.'); return; }
  /* global google */
  if(!gisInitialized){
    google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (resp)=>{
        try{
          await googleLoginWithIdToken(resp.credential);
          await refreshAuthUI();
          showGame();
        }catch(err){ console.error(err); alert('Login failed'); }
      }
    });
    gisInitialized = true;
  }
  google.accounts.id.prompt((notification)=>{
    if(notification.isNotDisplayed() || notification.isSkippedMoment()){
      google.accounts.id.renderButton(document.querySelector('#signinArea') || document.querySelector('#landingSignin'), { theme: 'outline', size: 'medium' });
    }
  });
}

export async function refreshAuthUI(){
  const { user } = await getSession();
  const userInfo = document.querySelector('#userInfo');
  const signinArea = document.querySelector('#signinArea');
  if(user){
    if(userInfo){ userInfo.hidden = false; }
    if(signinArea){ signinArea.hidden = true; }
    const nameEl = document.querySelector('#userName'); if(nameEl) nameEl.textContent = user.name || user.email || 'Signed in';
    const pic = document.querySelector('#userPic'); if(pic){ pic.src = user.picture || ''; pic.alt = user.name || ''; }
  } else {
    if(userInfo){ userInfo.hidden = true; }
    if(signinArea){ signinArea.hidden = false; }
  }
  return user || null;
}

export function showGame(){
  const landing = document.getElementById('landing');
  const root = document.getElementById('gameRoot');
  if(landing) landing.style.display = 'none';
  if(root) root.hidden = false;
}

function loadGisScript(){
  return new Promise((resolve, reject)=>{
    if(document.getElementById('gis-script')) return resolve();
    const s = document.createElement('script');
    s.id = 'gis-script'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
    s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
  });
}
import { getConfig, getSession, googleLoginWithIdToken, logout } from './api.js';

let googleClientId = '';
let gisReady = false;

export async function initAuthUI(){
  const { googleClientId: cid } = await getConfig();
  googleClientId = cid || '';
  if(googleClientId){
    await loadGisScript();
    gisReady = true;
  }
  await refreshAuthUI();
  const btn = document.querySelector('#btnSignin');
  if(btn){ btn.addEventListener('click', onSigninClick); }
  const btnLogout = document.querySelector('#btnLogout');
  if(btnLogout){ btnLogout.addEventListener('click', async ()=>{ await logout(); await refreshAuthUI(); }); }
}

async function onSigninClick(){
  if(!gisReady){ alert('Google login is not configured. You can still play and submit as Guest.'); return; }
  /* global google */
  google.accounts.id.initialize({
    client_id: googleClientId,
    callback: async (resp)=>{
      try{
        await googleLoginWithIdToken(resp.credential);
        await refreshAuthUI();
      }catch(err){ console.error(err); alert('Login failed'); }
    }
  });
  google.accounts.id.prompt((notification)=>{
    if(notification.isNotDisplayed() || notification.isSkippedMoment()){
      // Fallback: render a popup style prompt
      google.accounts.id.renderButton(document.querySelector('#signinArea'), { theme: 'outline', size: 'medium' });
    }
  });
}

export async function refreshAuthUI(){
  const { user } = await getSession();
  const userInfo = document.querySelector('#userInfo');
  const signinArea = document.querySelector('#signinArea');
  if(user){
    userInfo.hidden = false; signinArea.hidden = true;
    document.querySelector('#userName').textContent = user.name || user.email || 'Signed in';
    const pic = document.querySelector('#userPic');
    pic.src = user.picture || '';
    pic.alt = user.name || '';
  } else {
    userInfo.hidden = true; signinArea.hidden = false;
  }
  return user || null;
}

function loadGisScript(){
  return new Promise((resolve, reject)=>{
    if(document.getElementById('gis-script')) return resolve();
    const s = document.createElement('script');
    s.id = 'gis-script'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
    s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
  });
}
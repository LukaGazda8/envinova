// === KONFIGURÁCIA ===
const GITHUB_CLIENT_ID = 'Ov23lifhhRo1cn8W1sB4';
const WORKER_URL = 'https://docuflow.gazdarica-luka.workers.dev/'; // URL adresa tvojho Cloudflare Workeru

// 1. Presmerovanie na GitHub prihlásenie
function loginWithGithub() {
  const redirectUri = window.location.origin + window.location.pathname;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=gist&redirect_uri=${encodeURIComponent(redirectUri)}`;
  window.location.href = githubAuthUrl;
}

// 2. Spracovanie návratu z GitHubu (OAuth Callback)
async function handleGithubCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (!code) return;

  // Vyčistíme URL adresu od parametra ?code=...
  window.history.replaceState({}, document.title, window.location.pathname);

  try {
    // Získame Token cez náš Cloudflare Worker
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    const data = await res.json();

    if (data.access_token) {
      localStorage.setItem('github_token', data.access_token);
      alert('Úspešne prihlásený cez GitHub!');
      await initGithubGist(data.access_token);
    } else {
      alert('Chyba prihlásenia: ' + (data.error_description || 'Neznáma chyba'));
    }
  } catch (err) {
    console.error('OAuth chyba:', err);
  }
}

// 3. Inicializácia alebo načítanie Gistu pre DocuFlow
async function initGithubGist(token) {
  // Najprv skontrolujeme, či používateľ už má náš Gist
  const response = await fetch('https://api.github.com/gists', {
    headers: { 'Authorization': `token ${token}` }
  });
  
  const gists = await response.json();
  const existingGist = gists.find(g => g.files['docuflow_data.json']);

  if (existingGist) {
    localStorage.setItem('docuflow_gist_id', existingGist.id);
    // Načítame dáta z Gistu do aplikácie
    const content = existingGist.files['docuflow_data.json'].content;
    const appData = JSON.parse(content);
    console.log('Načítané dáta z GitHubu:', appData);
    // KÓD: Tu obnov svoj Store/UI s novými dátami
  } else {
    // Ak Gist neexistuje, vytvoríme nový prázdny
    await createNewGist(token);
  }
}

// Spustíme kontrolu pri načítaní stránky
window.addEventListener('DOMContentLoaded', handleGithubCallback);

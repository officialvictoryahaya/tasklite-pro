/* ============================================
   TASKLITE PRO - FIXED & ARRANGED
   FIX: Login stuck bug + Correct Supabase Key
   ============================================ */

const SUPABASE_URL = 'https://zfclurscqotfeekcvhey.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmY2x1cnNjcW90ZmVla2N2aGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMzc5MDksImV4cCI6MjEwNzcxMzkwOX0.yW_i3DD7-mw2p1WmsDIJfw8Uk82dRX_p95F5k5hWy1E'
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ---------- 1. STATE ----------
const $ = id => document.getElementById(id);
let tasks = JSON.parse(localStorage.getItem('tasklite-pro')||'[]');
let categories = JSON.parse(localStorage.getItem('tasklite-cats')||'["Work","Personal","Shopping","Study"]');
let currentCat = 'all', currentFilter = 'all', activeTag = null;
let currentUser = null, editingId = null, tempSubtasks = [];
let dark = localStorage.getItem('tasklite-dark') === '1';
if (dark) document.body.classList.add('dark');
let beepedIds = new Set();

// ---------- 2. HELPERS ----------
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; o.type = 'sine';
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    o.start(); o.stop(ctx.currentTime + 0.3);
  } catch(e){}
}
function isOverdue(t) {
  if (t.completed || !t.endDate) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(t.endDate); due.setHours(0,0,0,0);
  return due < today;
}
function isDueToday(t) {
  if (!t.endDate) return false;
  return t.endDate === new Date().toISOString().split('T')[0];
}
function saveLocal() {
  localStorage.setItem('tasklite-pro', JSON.stringify(tasks));
  localStorage.setItem('tasklite-cats', JSON.stringify(categories));
}
function parseTags(text) {
  return (text.match(/#[\w-]+/g) || []).map(t => t.replace('#','').toLowerCase());
}

// ---------- 3. AUTH - FIXED ----------
function showDashboard(user) {
  console.log("Showing dashboard for", user.email);
  currentUser = user;
  $('authPage').classList.add('hidden');
  $('appPage').classList.add('active');
  const meta = user.user_metadata || {};
  const fullName = meta.full_name || meta.name || user.email.split('@')[0];
  const avatarUrl = meta.avatar_url || meta.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=111827&color=fff&bold=true`;
  $('userEmailDisplay').textContent = user.email;
  $('userNameDisplay').textContent = `Hi, ${fullName} 👋`;
  const av = $('userAvatar');
  if (av) { av.src = avatarUrl; av.style.display = 'block'; av.referrerPolicy = 'no-referrer'; }
  loadFromCloud();
}

function showLogin() {
  console.log("Showing login");
  currentUser = null;
  $('authPage').classList.remove('hidden');
  $('appPage').classList.remove('active');
  const loader = $('loadingOverlay');
  if (loader) loader.classList.remove('active');
}

async function signIn() {
  const e = $('email').value.trim(), p = $('password').value.trim();
  if (!e || !p) { $('authError').textContent = 'Enter email and password'; return; }
  $('authError').textContent = 'Signing in...';
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email: e, password: p });
  if (error) { $('authError').textContent = error.message; console.error(error); }
  else { console.log("Sign in success", data); }
}

async function signUp() {
  const e = $('email').value.trim(), p = $('password').value.trim();
  if (p.length < 6) { $('authError').textContent = 'Password must be 6+ chars'; return; }
  const { error } = await supabaseClient.auth.signUp({ email: e, password: p });
  $('authError').textContent = error ? error.message : '✅ Created! Now Sign In';
}

async function signInWithGoogle() {
  const loader = $('loadingOverlay');
  if (loader) loader.classList.add('active');
  const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  if (error) { if (loader) loader.classList.remove('active'); $('authError').textContent = error.message; }
}

async function signOut() {
  await supabaseClient.auth.signOut();
  showLogin();
}

async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) showDashboard(data.session.user);
  else showLogin();
  
  supabaseClient.auth.onAuthStateChange((ev, sess) => {
    const loader = $('loadingOverlay');
    if (loader) loader.classList.remove('active');
    if (sess?.user) showDashboard(sess.user);
    else showLogin();
  });
}

// ---------- 4. CLOUD ----------
async function loadFromCloud() {
  if (!currentUser) return;
  const { data, error } = await supabaseClient.from('tasks').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  if (error) { console.error("Load error:", error.message); return; }
  if (data) {
    tasks = data.map(t => ({
      id: t.id, text: t.title, completed: t.is_completed || false,
      priority: t.priority || 'medium', startDate: t.start_date || null,
      endDate: t.due_date || null, repeat: 'none', category: t.category || 'Personal',
      tags: t.tags || [], subtasks: t.subtasks || [], createdAt: new Date(t.created_at).getTime()
    }));
    saveLocal(); render();
  }
}

// ---------- 5. RENDER ----------
function renderCats() {
  $('categoryList').innerHTML = `<button class="cat-btn ${currentCat==='all'?'active':''}" data-cat="all">📥 All Tasks <span>${tasks.length}</span></button>` + categories.map(c => `<button class="cat-btn ${currentCat===c?'active':''}" data-cat="${c}">${c} <span>${tasks.filter(t=>t.category===c).length}</span></button>`).join('');
  $('catInput').innerHTML = categories.map(c => `<option>${c}</option>`).join('');
  document.querySelectorAll('.cat-btn').forEach(b => {
    if (b.dataset.cat) {
      b.onclick = () => {
        currentCat = b.dataset.cat; render();
        if (window.innerWidth <= 768) {
          document.querySelector('.sidebar').classList.remove('open');
          $('sidebarOverlay').classList.remove('active');
        }
      }
    }
  });
}

function renderTags() {
  const all = [...new Set(tasks.flatMap(t => t.tags))];
  $('tagList').innerHTML = all.map(t => `<span class="tag-pill" data-tag="${t}">#${t}</span>`).join('') || '<span style="font-size:12px;color:var(--text2)">No tags yet - add #tag</span>';
  document.querySelectorAll('.tag-pill').forEach(el => {
    el.onclick = () => { activeTag = activeTag === el.dataset.tag ? null : el.dataset.tag; render(); }
  });
}

function render() {
  if (!$('categoryList')) return;
  renderCats(); renderTags();
  let filtered = [...tasks];
  if (currentCat !== 'all') filtered = filtered.filter(t => t.category === currentCat);
  if (currentFilter === 'active') filtered = filtered.filter(t => !t.completed);
  if (currentFilter === 'done') filtered = filtered.filter(t => t.completed);
  if (activeTag) filtered = filtered.filter(t => t.tags.includes(activeTag));
  const q = $('searchInput').value.toLowerCase();
  if (q) filtered = filtered.filter(t => t.text.toLowerCase().includes(q) || t.tags.some(tag => tag.includes(q)));
  const sort = $('sortInput').value;
  if (sort === 'priority') { const o = { high:0, medium:1, low:2 }; filtered.sort((a,b) => o[a.priority]-o[b.priority]); }
  if (sort === 'endDate') filtered.sort((a,b) => (a.endDate||'9999').localeCompare(b.endDate||'9999'));
  if (sort === 'alpha') filtered.sort((a,b) => a.text.localeCompare(b.text));

  let hasNewOverdue = false;
  filtered.forEach(t => { if (isOverdue(t) && !beepedIds.has(t.id)) { hasNewOverdue = true; beepedIds.add(t.id); } });
  if (hasNewOverdue) beep();

  $('taskList').innerHTML = '';
  if (!filtered.length) {
    $('taskList').innerHTML = `<li style="text-align:center;padding:40px;color:var(--text2);list-style:none">No tasks yet - use #tag!</li

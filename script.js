// TaskLite Pro - Final with Google Loading Spinner
const SUPABASE_URL = 'https://zfclurscqotfeekcvhey.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmY2x1cnNjcW90ZmVla2N2aGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMzc5MDksImV4cCI6MjEwNzcxMzkwOX0.yW_i3DD7-mw2p1WmsDIJfw8Uk82dRX_p95F5k5hWy1E'
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const $ = id => document.getElementById(id);
const authPage = $('authPage'), appPage = $('appPage');
const taskInput = $('taskInput'), addBtn = $('addBtn'), taskList = $('taskList');
const searchInput = $('searchInput'), sortInput = $('sortInput'), priorityInput = $('priorityInput');
const startDateInput = $('startDateInput'), endDateInput = $('endDateInput'), repeatInput = $('repeatInput'), catInput = $('catInput');
const categoryList = $('categoryList'), tagList = $('tagList'), taskCount = $('taskCount');
const emailInput = $('email'), passwordInput = $('password'), authError = $('authError'), userEmailDisplay = $('userEmailDisplay');

let tasks = JSON.parse(localStorage.getItem('tasklite-pro') || '[]');
let categories = JSON.parse(localStorage.getItem('tasklite-cats') || '["Work","Personal","Shopping","Study"]');
let currentCat = 'all', currentFilter = 'all', activeTag = null;
let dark = localStorage.getItem('tasklite-dark') === '1';
if(dark) document.body.classList.add('dark');
let currentUser = null;

function showDashboard(user){
  currentUser = user;
  authPage.classList.add('hidden');
  appPage.classList.add('active');
  userEmailDisplay.textContent = user.email;
  loadFromCloud();
}

function showLogin(){
  currentUser = null;
  authPage.classList.remove('hidden');
  appPage.classList.remove('active');
  const overlay = document.getElementById('loadingOverlay');
  if(overlay) overlay.classList.remove('active');
}

async function signUp(){
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if(!email || !password){ authError.textContent = 'Enter email and password'; return; }
  if(password.length < 6){ authError.textContent = 'Password must be 6+ chars'; return; }
  authError.textContent = 'Creating account...';
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if(error){ authError.textContent = error.message; }
  else { authError.textContent = '✅ Account created! Now click Sign In'; }
}

async function signIn(){
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if(!email || !password){ authError.textContent = 'Enter email and password'; return; }
  authError.textContent = 'Signing in...';
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error){ authError.textContent = error.message; }
}

async function signInWithGoogle(){
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('active');
  authError.textContent = '';
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if(error){
    overlay.classList.remove('active');
    authError.textContent = error.message;
  }
}

async function signOut(){
  await supabaseClient.auth.signOut();
  showLogin();
}

async function checkSession(){
  const { data } = await supabaseClient.auth.getSession();
  if(data.session){ showDashboard(data.session.user); } else { showLogin(); }
  supabaseClient.auth.onAuthStateChange((event, session)=>{
    const overlay = document.getElementById('loadingOverlay');
    if(overlay) overlay.classList.remove('active');
    if(session?.user){ showDashboard(session.user); } else { showLogin(); }
  });
}

async function loadFromCloud(){
  if(!currentUser) return;
  const { data: lists } = await supabaseClient.from('lists').select('*').eq('user_id', currentUser.id);
  if(lists && lists.length){ categories = lists.map(l=>l.name); }
  const { data: cloudTasks } = await supabaseClient.from('tasks').select('*').eq('user_id', currentUser.id).order('created_at',{ascending:false});
  if(cloudTasks && cloudTasks.length > 0){
    tasks = cloudTasks.map(t=>({
      id: t.id,
      text: t.title || '',
      completed: t.is_completed || false,
      priority: t.priority || 'medium',
      startDate: null,
      endDate: t.due_date || null,
      repeat: 'none',
      category: categories[0] || 'Work',
      tags: [],
      subtasks:[],
      createdAt: new Date(t.created_at).getTime(),
      order: 0,
    }));
  }
  saveLocal(); render();
}

async function saveToCloud(task){
  if(!currentUser) return;
  let list_id = null;
  const { data: list } = await supabaseClient.from('lists').select('id').eq('user_id', currentUser.id).eq('name', task.category).single();
  if(list) list_id = list.id;
  else {
    const { data: newList } = await supabaseClient.from('lists').insert({ user_id: currentUser.id, name: task.category }).select().single();
    if(newList) list_id = newList.id;
  }
  await supabaseClient.from('tasks').insert({
    user_id: currentUser.id,
    title: task.text,
    due_date: task.endDate || null,
    is_completed: task.completed,
    list_id: list_id
  });
}

function saveLocal(){ localStorage.setItem('tasklite-pro', JSON.stringify(tasks)); localStorage.setItem('tasklite-cats', JSON.stringify(categories)); }
function save(){ saveLocal(); }
function parseTags(text){ const m = text.match(/#[\w-]+/g) || []; return m.map(t => t.replace('#','').toLowerCase()); }

function renderCats(){
    categoryList.innerHTML = `<button class="cat-btn ${currentCat==='all'?'active':''}" data-cat="all">📥 All Tasks <span>${tasks.length}</span></button>` +
    categories.map(c => {
        const count = tasks.filter(t=>t.category===c).length;
        return `<button class="cat-btn ${currentCat===c?'active':''}" data-cat="${c}">${c} <span>${count}</span></button>`
    }).join('');
    catInput.innerHTML = categories.map(c=>`<option value="${c}">${c}</option>`).join('');
    document.querySelectorAll('.cat-btn').forEach(b=> b.onclick = ()=>{ currentCat = b.dataset.cat; render(); });
}
function renderTags(){
    const all = [...new Set(tasks.flatMap(t=>t.tags))];
    tagList.innerHTML = all.map(t=>`<span class="tag-pill ${activeTag===t?'active':''}" data-tag="${t}">#${t}</span>`).join('') || '<span style="font-size:12px;color:var(--text2)">No tags</span>';
    document.querySelectorAll('.tag-pill').forEach(el=> el.onclick = ()=>{ activeTag = activeTag===el.dataset.tag? null : el.dataset.tag; render(); });
}
function getFiltered(){
    let out = [...tasks];
    if(currentCat!=='all') out = out.filter(t=>t.category===currentCat);
    if(currentFilter==='active') out = out.filter(t=>!t.completed);
    if(currentFilter==='done') out = out.filter(t=>t.completed);
    if(activeTag) out = out.filter(t=>t.tags.includes(activeTag));
    const q = searchInput.value.toLowerCase();
    if(q) out = out.filter(t=> t.text.toLowerCase().includes(q) || t.tags.some(x=>x.includes(q)) || t.category.toLowerCase().includes(q));
    return out;
}
function render(){
    if(!categoryList) return;
    renderCats(); renderTags();
    const filtered = getFiltered();
    taskList.innerHTML = '';
    if(filtered.length===0){
        taskList.innerHTML = `<li style="text-align:center; padding:40px; color:var(--text2); list-style:none;"><div style="font-size:40px;">📝</div><p>No tasks yet</p></li>`;
    }
    filtered.forEach(task=>{
        const li = document.createElement('li');
        li.className = `task-card ${task.priority}`;
        li.innerHTML = `
            <div class="task-top">
                <input type="checkbox" ${task.completed?'checked':''} onchange="toggleTask('${task.id}')">
                <span class="task-title ${task.completed?'done':''}">${task.text.replace(/#[\w-]+/g,'')}</span>
                <button onclick="deleteTask('${task.id}')">✕</button>
            </div>
            <div class="meta">
                <span class="badge ${task.priority}">${task.priority}</span>
                ${task.endDate?`<span class="badge end">🏁 ${task.endDate}</span>`:''}
                <span class="badge">${task.category}</span>
                ${task.tags.map(t=>`<span class="badge">#${t}</span>`).join('')}
            </div>
        `;
        taskList.appendChild(li);
    });
    taskCount.textContent = `${filtered.length} tasks • ${tasks.filter(t=>!t.completed).length} pending`;
}
async function addTask(){
    const text = taskInput.value.trim(); if(!text) return;
    const task = {
        id: Date.now().toString(),
        text,
        completed:false,
        priority: priorityInput.value,
        startDate: startDateInput.value || null,
        endDate: endDateInput.value || null,
        repeat: repeatInput.value || 'none',
        category: catInput.value,
        tags: parseTags(text),
        subtasks:[],
        createdAt: Date.now(),
        order: tasks.length,
    };
    tasks.unshift(task);
    save(); render();
    taskInput.value='';
    if(currentUser) await saveToCloud(task);
}
window.toggleTask = async id=>{
    const t = tasks.find(x=>x.id===id); if(!t) return; t.completed = !t.completed; save(); render();
    if(currentUser && id.length > 10){
      await supabaseClient.from('tasks').update({ is_completed: t.completed }).eq('id', id);
    }
}
window.deleteTask = async id=>{ 
  tasks=tasks.filter(t=>t.id!==id); save(); render();
  if(currentUser && id.length > 10){
    await supabaseClient.from('tasks').delete().eq('id', id);
  }
}
addBtn.onclick = addTask;
if(taskInput) taskInput.addEventListener('keypress', e=>{ if(e.key==='Enter') addTask(); });
if(searchInput) searchInput.oninput = render;
document.querySelectorAll('.filter-btn').forEach(b=> b.onclick = ()=>{
    document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); currentFilter=b.dataset.filter; render();
});
if($('clearBtn')) $('clearBtn').onclick = ()=>{ tasks=tasks.filter(t=>!t.completed); save(); render(); }
if($('addCatBtn')) $('addCatBtn').onclick = async ()=>{
    const v=$('newCatInput').value.trim(); if(!v) return;
    if(!categories.includes(v)) categories.push(v);
    $('newCatInput').value=''; save(); render();
    if(currentUser) await supabaseClient.from('lists').insert({ user_id: currentUser.id, name: v });
}
if($('themeBtn')) $('themeBtn').onclick = ()=>{
    document.body.classList.toggle('dark');
    dark=!dark; localStorage.setItem('tasklite-dark', dark?'1':'0');
}
checkSession();
render();

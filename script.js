// TaskLite Pro - Final with Google Loading Spinner + Export + User Name
const SUPABASE_URL = 'https://zfclurscqotfeekcvhey.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmY2x1cnNjcW90ZmVla2N2aGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMzc5MDksImV4cCI6MjEwNzcxMzkwOX0.yW_i3DD7-mw2p1WmsDIJfw8Uk82dRX_p95F5k5hWy1E'
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)


const $ = id => document.getElementById(id);
let tasks = JSON.parse(localStorage.getItem('tasklite-pro')||'[]');
let categories = JSON.parse(localStorage.getItem('tasklite-cats')||'["Work","Personal","Shopping","Study"]');
let currentCat='all', currentFilter='all', activeTag=null, currentUser=null, editingId=null, tempSubtasks=[];
let dark = localStorage.getItem('tasklite-dark')==='1'; if(dark) document.body.classList.add('dark');
let beepedIds = new Set();

function beep(){
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value=880; o.type='sine';
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    o.start(); o.stop(ctx.currentTime+0.3);
  }catch(e){}
}
function isOverdue(t){
  if(t.completed||!t.endDate) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(t.endDate); due.setHours(0,0,0,0);
  return due < today;
}
function isDueToday(t){
  if(!t.endDate) return false;
  return t.endDate === new Date().toISOString().split('T')[0];
}

function showDashboard(user){
  currentUser=user;
  $('authPage').classList.add('hidden'); $('appPage').classList.add('active');
  const meta=user.user_metadata||{}; const fullName=meta.full_name||meta.name||user.email.split('@')[0];
  const avatarUrl=meta.avatar_url||meta.picture||`https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=111827&color=fff&bold=true`;
  $('userEmailDisplay').textContent=user.email;
  $('userNameDisplay').textContent=`Hi, ${fullName} 👋`;
  const av=$('userAvatar'); if(av){ av.src=avatarUrl; av.style.display='block'; av.referrerPolicy='no-referrer'; }
  loadFromCloud();
}
function showLogin(){ currentUser=null; $('authPage').classList.remove('hidden'); $('appPage').classList.remove('active'); $('loadingOverlay').classList.remove('active'); }
async function signIn(){ const e=$('email').value.trim(), p=$('password').value.trim(); if(!e||!p){ $('authError').textContent='Enter email and password'; return; } $('authError').textContent='Signing in...'; const {error}=await supabaseClient.auth.signInWithPassword({email:e,password:p}); if(error) $('authError').textContent=error.message; }
async function signUp(){ const e=$('email').value.trim(), p=$('password').value.trim(); if(p.length<6){ $('authError').textContent='Password must be 6+ chars'; return; } const {error}=await supabaseClient.auth.signUp({email:e,password:p}); $('authError').textContent=error?error.message:'✅ Created! Now Sign In'; }
async function signInWithGoogle(){ $('loadingOverlay').classList.add('active'); const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}}); if(error){ $('loadingOverlay').classList.remove('active'); $('authError').textContent=error.message; } }
async function signOut(){ await supabaseClient.auth.signOut(); showLogin(); }
async function checkSession(){ const {data}=await supabaseClient.auth.getSession(); if(data.session) showDashboard(data.session.user); else showLogin(); supabaseClient.auth.onAuthStateChange((ev,sess)=>{ $('loadingOverlay').classList.remove('active'); if(sess?.user) showDashboard(sess.user); else showLogin(); }); }
async function loadFromCloud(){ if(!currentUser) return; const {data}=await supabaseClient.from('tasks').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false}); if(data&&data.length){ tasks=data.map(t=>({id:t.id,text:t.title,completed:t.is_completed||false,priority:t.priority||'medium',startDate:t.start_date||null,endDate:t.due_date||null,repeat:'none',category:t.category||'Personal',tags:t.tags||[],subtasks:t.subtasks||[],createdAt:new Date(t.created_at).getTime()})); saveLocal(); render(); } }
function saveLocal(){ localStorage.setItem('tasklite-pro',JSON.stringify(tasks)); localStorage.setItem('tasklite-cats',JSON.stringify(categories)); }
function parseTags(text){ return (text.match(/#[\w-]+/g)||[]).map(t=>t.replace('#','').toLowerCase()); }

function renderCats(){
  $('categoryList').innerHTML=`<button class="cat-btn ${currentCat==='all'?'active':''}" data-cat="all">📥 All Tasks <span>${tasks.length}</span></button>`+categories.map(c=>`<button class="cat-btn ${currentCat===c?'active':''}" data-cat="${c}">${c} <span>${tasks.filter(t=>t.category===c).length}</span></button>`).join('');
  $('catInput').innerHTML=categories.map(c=>`<option>${c}</option>`).join('');
  document.querySelectorAll('.cat-btn').forEach(b=>b.onclick=()=>{ currentCat=b.dataset.cat; render(); if(window.innerWidth<=768){ document.querySelector('.sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('active'); } });
}
function renderTags(){
  const all=[...new Set(tasks.flatMap(t=>t.tags))];
  $('tagList').innerHTML=all.map(t=>`<span class="tag-pill" data-tag="${t}">#${t}</span>`).join('')||'<span style="font-size:12px;color:var(--text2)">No tags</span>';
  document.querySelectorAll('.tag-pill').forEach(el=>el.onclick=()=>{ activeTag=activeTag===el.dataset.tag?null:el.dataset.tag; render(); });
}

function render(){
  if(!$('categoryList')) return; renderCats(); renderTags();
  let filtered=[...tasks];
  if(currentCat!=='all') filtered=filtered.filter(t=>t.category===currentCat);
  if(currentFilter==='active') filtered=filtered.filter(t=>!t.completed);
  if(currentFilter==='done') filtered=filtered.filter(t=>t.completed);
  const q=$('searchInput').value.toLowerCase(); if(q) filtered=filtered.filter(t=>t.text.toLowerCase().includes(q));
  const sort=$('sortInput').value; if(sort==='priority'){ const o={high:0,medium:1,low:2}; filtered.sort((a,b)=>o[a.priority]-o[b.priority]); } if(sort==='endDate') filtered.sort((a,b)=>(a.endDate||'9999').localeCompare(b.endDate||'9999'));

  let hasNewOverdue=false;
  filtered.forEach(t=>{ if(isOverdue(t)&&!beepedIds.has(t.id)){ hasNewOverdue=true; beepedIds.add(t.id); } });
  if(hasNewOverdue) beep();

  $('taskList').innerHTML='';
  if(!filtered.length){ $('taskList').innerHTML=`<li style="text-align:center; padding:40px; color:var(--text2); list-style:none;">No tasks yet</li>`; }
  filtered.forEach(task=>{
    const overdue=isOverdue(task); const dueToday=isDueToday(task);
    const status = overdue ? 'Overdue' : task.completed ? 'Done' : dueToday ? 'Due Today' : 'Pending';
    const li=document.createElement('li'); li.className=`task-card ${task.priority} ${overdue?'overdue':''}`;
    li.innerHTML=`
      <div class="task-top">
        <input type="checkbox" ${task.completed?'checked':''} onchange="toggleTask('${task.id}')">
        <span class="task-title ${task.completed?'done':''}" onclick="openEdit('${task.id}')">${task.text.replace(/#[\w-]+/g,'')}</span>
        <button onclick="openEdit('${task.id}')" style="border:none;background:transparent;cursor:pointer;">✏</button>
        <button onclick="deleteTask('${task.id}')" style="border:none;background:transparent;cursor:pointer;">✕</button>
      </div>
      ${task.subtasks&&task.subtasks.length? task.subtasks.map((s,i)=>`<div class="subtask-row"><input type="checkbox" ${s.done?'checked':''} onchange="toggleSubtask('${task.id}',${i})"><span style="${s.done?'text-decoration:line-through;opacity:.6':''}">${s.title}</span><button onclick="removeSubtask('${task.id}',${i})" style="margin-left:auto;border:none;background:transparent;cursor:pointer;">❌</button></div>`).join(''):''}
      <div class="meta">
        <span class="badge ${task.priority}">${task.priority}</span>
        ${task.endDate?`<span class="badge ${overdue?'overdue-badge':''}">${overdue?'🔴':''} ${task.endDate}</span>`:''}
        <span class="badge">${task.category}</span>
        <span class="badge ${overdue?'overdue-badge':''}">${overdue?'🔴 Overdue':status}</span>
        ${task.tags.map(t=>`<span class="badge">#${t}</span>`).join('')}
      </div>
    `;
    $('taskList').appendChild(li);
  });
  $('taskCount').textContent=`${filtered.length} tasks • ${tasks.filter(t=>!t.completed).length} pending${filtered.some(isOverdue)?' • 🔴 Overdue!':''}`;
}

async function addTask(){
  const text=$('taskInput').value.trim(); if(!text) return;
  const task={id:Date.now().toString(),text,completed:false,priority:$('priorityInput').value,startDate:$('startDateInput').value||null,endDate:$('endDateInput').value||null,repeat:$('repeatInput').value,category:$('catInput').value,tags:parseTags(text),subtasks:[],createdAt:Date.now()};
  tasks.unshift(task); saveLocal(); render(); $('taskInput').value='';
  if(currentUser) await supabaseClient.from('tasks').insert({id:task.id,user_id:currentUser.id,title:task.text,due_date:task.endDate,is_completed:false,priority:task.priority,category:task.category,tags:task.tags,subtasks:task.subtasks,start_date:task.startDate});
}
window.toggleTask=async id=>{ const t=tasks.find(x=>x.id===id); t.completed=!t.completed; saveLocal(); render(); if(currentUser) await supabaseClient.from('tasks').update({is_completed:t.completed}).eq('id',id); }
window.deleteTask=async id=>{ tasks=tasks.filter(t=>t.id!==id); saveLocal(); render(); if(currentUser) await supabaseClient.from('tasks').delete().eq('id',id); }
window.openEdit=id=>{ const t=tasks.find(x=>x.id===id); if(!t) return; editingId=id; tempSubtasks=JSON.parse(JSON.stringify(t.subtasks||[])); const et=$('editTitleInput'); if(et) et.value=t.text.replace(/#[\w-]+/g,''); const ed=$('editDateInput'); if(ed) ed.value=t.endDate||''; const ep=$('editPriorityInput'); if(ep) ep.value=t.priority; renderEditSubtasks(); const em=$('editModal'); if(em) em.classList.remove('hidden'); }
window.renderEditSubtasks=()=>{ const es=$('editSubtasks'); if(!es) return; es.innerHTML=tempSubtasks.map((s,i)=>`<div class="subtask-row"><input type="checkbox" ${s.done?'checked':''} onchange="tempSubtasks[${i}].done=!tempSubtasks[${i}].done"><span>${s.title}</span><button onclick="tempSubtasks.splice(${i},1); renderEditSubtasks()" style="margin-left:auto;border:none;background:transparent;">❌</button></div>`).join(''); }
window.addSubtaskInEdit=()=>{ const v=$('newSubtaskInput').value.trim(); if(!v) return; tempSubtasks.push({title:v,done:false}); $('newSubtaskInput').value=''; renderEditSubtasks(); }
window.toggleSubtask=(tid,idx)=>{ const t=tasks.find(x=>x.id===tid); t.subtasks[idx].done=!t.subtasks[idx].done; saveLocal(); render(); if(currentUser) supabaseClient.from('tasks').update({subtasks:t.subtasks}).eq('id',tid).then(()=>{}); }
window.removeSubtask=(tid,idx)=>{ const t=tasks.find(x=>x.id===tid); t.subtasks.splice(idx,1); saveLocal(); render(); }
window.saveEdit=async()=>{ const t=tasks.find(x=>x.id===editingId); t.text=$('editTitleInput').value; t.endDate=$('editDateInput').value||null; t.priority=$('editPriorityInput').value; t.subtasks=tempSubtasks; saveLocal(); closeEdit(); render(); if(currentUser) await supabaseClient.from('tasks').update({title:t.text,due_date:t.endDate,priority:t.priority,subtasks:t.subtasks}).eq('id',editingId); }
window.closeEdit=()=>{ const em=$('editModal'); if(em) em.classList.add('hidden'); editingId=null; }

$('addBtn').onclick=addTask; $('taskInput').addEventListener('keypress',e=>{ if(e.key==='Enter') addTask(); });
$('searchInput').oninput=render; $('sortInput').onchange=render;
document.querySelectorAll('.filter-btn').forEach(b=>b.onclick=()=>{ document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); currentFilter=b.dataset.filter; render(); });
$('clearBtn').onclick=()=>{ tasks=tasks.filter(t=>!t.completed); saveLocal(); render(); }
$('addCatBtn').onclick=async()=>{ const v=$('newCatInput').value.trim(); if(!v||categories.includes(v)) return; categories.push(v); $('newCatInput').value=''; saveLocal(); render(); if(currentUser) await supabaseClient.from('lists').insert({user_id:currentUser.id,name:v}); }
$('themeBtn').onclick=()=>{ document.body.classList.toggle('dark'); dark=!dark; localStorage.setItem('tasklite-dark',dark?'1':'0'); }
$('exportBtn').onclick=()=>{ if(!tasks.length) return alert('No tasks'); const data=tasks.map(t=>({Title:t.text,Status:t.completed?'Done':isOverdue(t)?'Overdue':'Pending',Priority:t.priority,Category:t.category,Due:t.endDate||''})); const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Tasks'); XLSX.writeFile(wb,`TaskLite-${new Date().toISOString().split('T')[0]}.xlsx`); }

checkSession(); render();

// ===== MOBILE HAMBURGER MENU - WORKING =====
document.addEventListener('DOMContentLoaded', function() {
  const menuBtn = document.getElementById('menuBtn');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!menuBtn || !sidebar || !overlay) return;
  menuBtn.addEventListener('click', function(e){
    e.stopPropagation();
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });
  overlay.addEventListener('click', function(){
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
});


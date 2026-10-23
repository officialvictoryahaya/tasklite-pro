/ TaskLite Pro - Final with Google Loading Spinner + Export + User Name
const SUPABASE_URL = 'https://zfclurscqotfeekcvhey.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmY2x1cnNjcW90ZmVla2N2aGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMzc5MDksImV4cCI6MjEwNzcxMzkwOX0.yW_i3DD7-mw2p1WmsDIJfw8Uk82dRX_p95F5k5hWy1E'
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// /* TASKLITE PRO - BUTTONS FIXED - 100% WORKING */
// const SUPABASE_URL = 'https://zfclurscqotfeekcvhey.supabase.co'
// const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.[STRIPPED 127 bytes].yW_i3DD7-mw2p1WmsDIJfw8Uk82dRX_p95F5k5hWy1E'

let supabaseClient = null;
try {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("Supabase connected");
} catch(e) {
  console.error("Supabase failed", e);
}

const $ = id => document.getElementById(id);
let tasks = JSON.parse(localStorage.getItem('tasklite-pro')||'[]');
let categories = JSON.parse(localStorage.getItem('tasklite-cats')||'["Work","Personal","Shopping","Study"]');
let currentCat='all', currentFilter='all', activeTag=null, currentUser=null, editingId=null, tempSubtasks=[];
let dark = localStorage.getItem('tasklite-dark')==='1';
if(dark) document.body.classList.add('dark');
let beepedIds = new Set();

function beep(){ try{ const c=new(window.AudioContext||window.webkitAudioContext)(); const o=c.createOscillator(); const g=c.createGain(); o.frequency.value=880; o.type='sine'; o.connect(g); g.connect(c.destination); g.gain.setValueAtTime(0.35,c.currentTime); o.start(); o.stop(c.currentTime+0.3);}catch(e){} }
function isOverdue(t){ if(t.completed||!t.endDate) return false; const a=new Date(); a.setHours(0,0,0,0); const b=new Date(t.endDate); b.setHours(0,0,0,0); return b<a; }
function isDueToday(t){ if(!t.endDate) return false; return t.endDate===new Date().toISOString().split('T')[0]; }
function saveLocal(){ localStorage.setItem('tasklite-pro',JSON.stringify(tasks)); localStorage.setItem('tasklite-cats',JSON.stringify(categories)); }
function parseTags(t){ return (t.match(/#[\w-]+/g)||[]).map(x=>x.replace('#','').toLowerCase()); }

window.showDashboard = function(user){
  currentUser=user;
  const authPage = $('authPage'); const appPage = $('appPage');
  if(authPage) authPage.classList.add('hidden');
  if(appPage) appPage.classList.add('active');
  const meta=user.user_metadata||{};
  const fullName=meta.full_name||meta.name||user.email.split('@')[0];
  const avatarUrl=meta.avatar_url||meta.picture||`https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=111827&color=fff&bold=true`;
  if($('userEmailDisplay')) $('userEmailDisplay').textContent=user.email;
  if($('userNameDisplay')) $('userNameDisplay').textContent=`Hi, ${fullName} 👋`;
  const av=$('userAvatar'); if(av){ av.src=avatarUrl; av.style.display='block'; }
  loadFromCloud();
}

window.showLogin = function(){
  currentUser=null;
  const authPage = $('authPage'); const appPage = $('appPage');
  if(authPage) authPage.classList.remove('hidden');
  if(appPage) appPage.classList.remove('active');
  const loader=$('loadingOverlay'); if(loader) loader.classList.remove('active');
}

window.signIn = async function(){
  const emailEl=$('email'), passEl=$('password'), errEl=$('authError');
  const e=emailEl?emailEl.value.trim():'', p=passEl?passEl.value.trim():'';
  if(!e||!p){ if(errEl) errEl.textContent='Enter email and password'; return; }
  if(errEl) errEl.textContent='Signing in...';
  try{
    const {data,error}=await supabaseClient.auth.signInWithPassword({email:e,password:p});
    if(error){ if(errEl) errEl.textContent=error.message; console.error(error); }
    else { if(errEl) errEl.textContent='✅ Success! Loading...'; }
  }catch(err){ if(errEl) errEl.textContent=err.message; }
}

window.signUp = async function(){
  const e=$('email')?$('email').value.trim():'', p=$('password')?$('password').value.trim():'', errEl=$('authError');
  if(p.length<6){ if(errEl) errEl.textContent='Password must be 6+ chars'; return; }
  try{
    const {error}=await supabaseClient.auth.signUp({email:e,password:p});
    if(errEl) errEl.textContent=error?error.message:'✅ Created! Now Sign In';
  }catch(err){ if(errEl) errEl.textContent=err.message; }
}

window.signInWithGoogle = async function(){
  const loader=$('loadingOverlay'); if(loader) loader.classList.add('active');
  try{
    const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}});
    if(error){ if(loader) loader.classList.remove('active'); const errEl=$('authError'); if(errEl) errEl.textContent=error.message; }
  }catch(err){ if(loader) loader.classList.remove('active'); }
}

window.signOut = async function(){ try{ await supabaseClient.auth.signOut(); }catch(e){} window.showLogin(); }

async function checkSession(){
  if(!supabaseClient) { window.showLogin(); return; }
  try{
    const {data}=await supabaseClient.auth.getSession();
    if(data.session) window.showDashboard(data.session.user); else window.showLogin();
    supabaseClient.auth.onAuthStateChange((ev,sess)=>{
      const loader=$('loadingOverlay'); if(loader) loader.classList.remove('active');
      if(sess?.user) window.showDashboard(sess.user); else window.showLogin();
    });
  }catch(e){ console.error(e); window.showLogin(); }
}

async function loadFromCloud(){
  if(!currentUser||!supabaseClient) return;
  try{
    const {data,error}=await supabaseClient.from('tasks').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false});
    if(error){ console.error(error); return; }
    if(data){
      tasks=data.map(t=>({id:t.id,text:t.title,completed:t.is_completed||false,priority:t.priority||'medium',startDate:t.start_date||null,endDate:t.due_date||null,repeat:'none',category:t.category||'Personal',tags:t.tags||[],subtasks:t.subtasks||[],createdAt:new Date(t.created_at).getTime()}));
      saveLocal(); render();
    }
  }catch(e){ console.error(e); }
}

function renderCats(){
  const catList=$('categoryList'); const catInput=$('catInput');
  if(catList) catList.innerHTML=`<button class="cat-btn ${currentCat==='all'?'active':''}" data-cat="all">📥 All Tasks <span>${tasks.length}</span></button>`+categories.map(c=>`<button class="cat-btn ${currentCat===c?'active':''}" data-cat="${c}">${c} <span>${tasks.filter(t=>t.category===c).length}</span></button>`).join('');
  if(catInput) catInput.innerHTML=categories.map(c=>`<option>${c}</option>`).join('');
  document.querySelectorAll('.cat-btn').forEach(b=>{ if(b.dataset.cat){ b.onclick=()=>{ currentCat=b.dataset.cat; render(); if(window.innerWidth<=768){ document.querySelector('.sidebar').classList.remove('open'); const ov=$('sidebarOverlay'); if(ov) ov.classList.remove('active'); } } } });
}
function renderTags(){
  const tagList=$('tagList'); if(!tagList) return;
  const all=[...new Set(tasks.flatMap(t=>t.tags))];
  tagList.innerHTML=all.map(t=>`<span class="tag-pill" data-tag="${t}">#${t}</span>`).join('')||'<span style="font-size:12px;color:var(--text2)">No tags yet - add #tag</span>';
  document.querySelectorAll('.tag-pill').forEach(el=>{ el.onclick=()=>{ activeTag=activeTag===el.dataset.tag?null:el.dataset.tag; render(); } });
}
function render(){
  const catList=$('categoryList'); if(!catList) return;
  renderCats(); renderTags();
  let filtered=[...tasks];
  if(currentCat!=='all') filtered=filtered.filter(t=>t.category===currentCat);
  if(currentFilter==='active') filtered=filtered.filter(t=>!t.completed);
  if(currentFilter==='done') filtered=filtered.filter(t=>t.completed);
  if(activeTag) filtered=filtered.filter(t=>t.tags.includes(activeTag));
  const searchInput=$('searchInput'); const q=searchInput?searchInput.value.toLowerCase():'';
  if(q) filtered=filtered.filter(t=>t.text.toLowerCase().includes(q)||t.tags.some(tag=>tag.includes(q)));
  const sortEl=$('sortInput'); const sort=sortEl?sortEl.value:'order';
  if(sort==='priority'){ const o={high:0,medium:1,low:2}; filtered.sort((a,b)=>o[a.priority]-o[b.priority]); }
  if(sort==='endDate') filtered.sort((a,b)=>(a.endDate||'9999').localeCompare(b.endDate||'9999'));
  if(sort==='alpha') filtered.sort((a,b)=>a.text.localeCompare(b.text));
  const taskList=$('taskList'); if(!taskList) return;
  taskList.innerHTML='';
  if(!filtered.length){ taskList.innerHTML=`<li style="text-align:center;padding:40px;color:var(--text2);list-style:none">No tasks yet - use #tag!</li>`; }
  filtered.forEach(task=>{
    const overdue=isOverdue(task); const dueToday=isDueToday(task);
    const status=overdue?'Overdue':task.completed?'Done':dueToday?'Due Today':'Pending';
    const li=document.createElement('li'); li.className=`task-card ${task.priority} ${overdue?'overdue':''}`;
    li.innerHTML=`<div class="task-top"><input type="checkbox" ${task.completed?'checked':''} onchange="toggleTask('${task.id}')"><span class="task-title ${task.completed?'done':''}" onclick="openEdit('${task.id}')">${task.text.replace(/#[\w-]+/g,'').trim()||task.text}</span><button onclick="openEdit('${task.id}')" style="border:none;background:transparent;cursor:pointer;font-size:16px">✏️</button><button onclick="deleteTask('${task.id}')" style="border:none;background:transparent;cursor:pointer;font-size:16px">✕</button></div>${task.subtasks&&task.subtasks.length?task.subtasks.map((s,i)=>`<div class="subtask-row"><input type="checkbox" ${s.done?'checked':''} onchange="toggleSubtask('${task.id}',${i})"><span style="${s.done?'text-decoration:line-through;opacity:.6':''}">${s.title}</span><button onclick="removeSubtask('${task.id}',${i})" style="margin-left:auto;border:none;background:transparent;cursor:pointer">❌</button></div>`).join(''):''}<div class="meta"><span class="badge ${task.priority}">${task.priority}</span>${task.endDate?`<span class="badge ${overdue?'overdue-badge':''}">${overdue?'🔴':''} ${task.endDate}</span>`:''}<span class="badge">${task.category}</span><span class="badge ${overdue?'overdue-badge':''}">${status}</span>${task.tags.map(t=>`<span class="badge">#${t}</span>`).join('')}</div>`;
    taskList.appendChild(li);
  });
  const taskCount=$('taskCount'); if(taskCount) taskCount.textContent=`${filtered.length} tasks • ${tasks.filter(t=>!t.completed).length} pending`;
}

async function addTask(){
  const input=$('taskInput'); if(!input) return;
  const text=input.value.trim(); if(!text) return;
  const tags=parseTags(text);
  const prioEl=$('priorityInput'), startEl=$('startDateInput'), endEl=$('endDateInput'), repeatEl=$('repeatInput'), catEl=$('catInput');
  const task={id:Date.now().toString(),text,completed:false,priority:prioEl?prioEl.value:'medium',startDate:startEl?startEl.value:null,endDate:endEl?endEl.value:null,repeat:repeatEl?repeatEl.value:'none',category:catEl?catEl.value:'Personal',tags,subtasks:[],createdAt:Date.now()};
  tasks.unshift(task); saveLocal(); render(); input.value='';
  if(currentUser&&supabaseClient){
    try{
      const {data,error}=await supabaseClient.from('tasks').insert({user_id:currentUser.id,title:task.text,due_date:task.endDate,is_completed:false,priority:task.priority,category:task.category,tags:task.tags,subtasks:task.subtasks,start_date:task.startDate}).select();
      if(!error&&data&&data[0]){ task.id=data[0].id; saveLocal(); }
    }catch(e){ console.error(e); }
  }
}
window.toggleTask=async id=>{ const t=tasks.find(x=>x.id===id); if(!t)return; t.completed=!t.completed; saveLocal(); render(); if(currentUser&&supabaseClient) try{ await supabaseClient.from('tasks').update({is_completed:t.completed}).eq('id',id); }catch(e){} }
window.deleteTask=async id=>{ tasks=tasks.filter(t=>t.id!==id); saveLocal(); render(); if(currentUser&&supabaseClient) try{ await supabaseClient.from('tasks').delete().eq('id',id); }catch(e){} }
window.openEdit=id=>{ const t=tasks.find(x=>x.id===id); if(!t)return; editingId=id; tempSubtasks=JSON.parse(JSON.stringify(t.subtasks||[])); const ti=$('editTitleInput'), di=$('editDateInput'), pi=$('editPriorityInput'); if(ti) ti.value=t.text; if(di) di.value=t.endDate||''; if(pi) pi.value=t.priority; renderEditSubtasks(); const em=$('editModal'); if(em) em.classList.remove('hidden'); }
window.renderEditSubtasks=()=>{ const es=$('editSubtasks'); if(!es)return; es.innerHTML=tempSubtasks.map((s,i)=>`<div class="subtask-row"><input type="checkbox" ${s.done?'checked':''} onchange="tempSubtasks[${i}].done=!tempSubtasks[${i}].done;renderEditSubtasks()"><span style="${s.done?'text-decoration:line-through;opacity:.6':''}">${s.title}</span><button onclick="tempSubtasks.splice(${i},1);renderEditSubtasks()" style="margin-left:auto;border:none;background:transparent;cursor:pointer">❌</button></div>`).join('')||'<div style="color:var(--text2);font-size:12px;padding:8px 0">No subtasks</div>'; }
window.addSubtaskInEdit=()=>{ const v=$('newSubtaskInput'); if(!v)return; const val=v.value.trim(); if(!val)return; tempSubtasks.push({title:val,done:false}); v.value=''; renderEditSubtasks(); }
window.toggleSubtask=async(tid,idx)=>{ const t=tasks.find(x=>x.id===tid); if(!t)return; t.subtasks[idx].done=!t.subtasks[idx].done; saveLocal(); render(); if(currentUser&&supabaseClient) try{ await supabaseClient.from('tasks').update({subtasks:t.subtasks}).eq('id',tid); }catch(e){} }
window.removeSubtask=async(tid,idx)=>{ const t=tasks.find(x=>x.id===tid); if(!t)return; t.subtasks.splice(idx,1); saveLocal(); render(); if(currentUser&&supabaseClient) try{ await supabaseClient.from('tasks').update({subtasks:t.subtasks}).eq('id',tid); }catch(e){} }
window.saveEdit=async()=>{ const t=tasks.find(x=>x.id===editingId); if(!t)return; const ntEl=$('editTitleInput'); const nt=ntEl?ntEl.value.trim():''; if(!nt)return; t.text=nt; t.tags=parseTags(nt); const de=$('editDateInput'), pe=$('editPriorityInput'); t.endDate=de?de.value||null:null; t.priority=pe?pe.value:'medium'; t.subtasks=tempSubtasks; saveLocal(); window.closeEdit(); render(); if(currentUser&&supabaseClient) try{ await supabaseClient.from('tasks').update({title:t.text,due_date:t.endDate,priority:t.priority,subtasks:t.subtasks,tags:t.tags}).eq('id',editingId); }catch(e){} }
window.closeEdit=()=>{ const em=$('editModal'); if(em) em.classList.add('hidden'); editingId=null; }

document.addEventListener('DOMContentLoaded',()=>{
  const addBtn=$('addBtn'), taskInput=$('taskInput'), searchInput=$('searchInput'), sortInput=$('sortInput'), clearBtn=$('clearBtn'), addCatBtn=$('addCatBtn'), themeBtn=$('themeBtn'), exportBtn=$('exportBtn'), menuBtn=$('menuBtn'), overlay=$('sidebarOverlay');
  if(addBtn) addBtn.onclick=addTask;
  if(taskInput) taskInput.addEventListener('keypress',e=>{ if(e.key==='Enter') addTask(); });
  if(searchInput) searchInput.oninput=render;
  if(sortInput) sortInput.onchange=render;
  document.querySelectorAll('.filter-btn').forEach(b=>b.onclick=()=>{ document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); currentFilter=b.dataset.filter; render(); });
  if(clearBtn) clearBtn.onclick=async()=>{ const d=tasks.filter(t=>t.completed); tasks=tasks.filter(t=>!t.completed); saveLocal(); render(); if(currentUser&&supabaseClient&&d.length){ for(const t of d){ try{ await supabaseClient.from('tasks').delete().eq('id',t.id); }catch(e){} } } }
  if(addCatBtn) addCatBtn.onclick=async()=>{ const v=$('newCatInput')?$('newCatInput').value.trim():''; if(!v||categories.includes(v))return; categories.push(v); const inp=$('newCatInput'); if(inp) inp.value=''; saveLocal(); render(); if(currentUser&&supabaseClient) try{ await supabaseClient.from('lists').insert({user_id:currentUser.id,name:v}); }catch(e){} }
  if(themeBtn) themeBtn.onclick=()=>{ document.body.classList.toggle('dark'); dark=!dark; localStorage.setItem('tasklite-dark',dark?'1':'0'); }
  if(exportBtn) exportBtn.onclick=()=>{ if(!tasks.length)return alert('No tasks'); const data=tasks.map(t=>({Title:t.text.replace(/#[\w-]+/g,'').trim(),Status:t.completed?'Done':isOverdue(t)?'Overdue':'Pending',Priority:t.priority,Category:t.category,Due:t.endDate||'',Tags:t.tags.join(',')})); const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Tasks'); XLSX.writeFile(wb,`TaskLite-${new Date().toISOString().split('T')[0]}.xlsx`); }
  if(menuBtn&&overlay){
    menuBtn.addEventListener('click',e=>{ e.stopPropagation(); const sb=document.querySelector('.sidebar'); if(sb) sb.classList.toggle('open'); overlay.classList.toggle('active'); });
    overlay.addEventListener('click',()=>{ const sb=document.querySelector('.sidebar'); if(sb) sb.classList.remove('open'); overlay.classList.remove('active'); });
  }
  checkSession(); render();
});

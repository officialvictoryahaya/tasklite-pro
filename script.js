// ============================================
// TASKLITE PRO - CLEANED FROM YOUR CODE v101
// FIXED: Duplicate + Regex + Line by Line
// ============================================

if (typeof window.SUPABASE_URL === 'undefined') {
  window.SUPABASE_URL = 'https://zfclurscqotfeekcvhey.supabase.co';
}

if (typeof window.SUPABASE_ANON_KEY === 'undefined') {
  window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmY2x1cnNjcW90ZmVla2N2aGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMzc5MDksImV4cCI6MjEwNzcxMzkwOX0.yW_i3DD7-mw2p1WmsDIJfw8Uk82dRX_p95F5k5hWy1E';
}

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;



if (!window.supabaseClient) {
  try {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) { console.error(e); }
}
const supabaseClient = window.supabaseClient;
const $ = function(id) { return document.getElementById(id); };
let tasks = JSON.parse(localStorage.getItem('tasklite-pro') || '[]');
let categories = JSON.parse(localStorage.getItem('tasklite-cats') || '["Work","Personal","Shopping","Study"]');
let currentCat = 'all';
let currentFilter = 'all';
let activeTag = null;
let currentUser = null;
let editingId = null;
let tempSubtasks = [];
let notifiedDueTasks = JSON.parse(localStorage.getItem('tasklite-notified') || '[]');
let dark = localStorage.getItem('tasklite-dark') === '1';
if (dark) { document.body.classList.add('dark'); }

function parseTags(text) {
  if (!text) return [];
  const re = new RegExp('#[\\w-]+', 'g');
  const m = text.match(re);
  if (!m) return [];
  return m.map(function(t) { return t.replace('#', '').toLowerCase(); });
}
function cleanTitle(text) {
  if (!text) return '';
  const re = new RegExp('#[\\w-]+', 'g');
  return text.replace(re, '').trim();
}
function saveLocal() {
  localStorage.setItem('tasklite-pro', JSON.stringify(tasks));
  localStorage.setItem('tasklite-cats', JSON.stringify(categories));
  localStorage.setItem('tasklite-notified', JSON.stringify(notifiedDueTasks));
}
function isOverdue(t) {
  if (t.completed || !t.endDate) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(t.endDate); due.setHours(0,0,0,0);
  return due < today;
}
function isDueToday(t) {
  if (t.completed || !t.endDate) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  return t.endDate === todayStr;
}
function isDueTomorrow(t) {
  if (t.completed || !t.endDate) return false;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  return t.endDate === tomorrowStr;
}
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function getNextRepeatDate(dateStr, repeatType) {
  if (!dateStr || repeatType === 'none') return null;
  const d = new Date(dateStr);
  if (repeatType === 'daily') d.setDate(d.getDate()+1);
  if (repeatType === 'weekly') d.setDate(d.getDate()+7);
  if (repeatType === 'monthly') d.setMonth(d.getMonth()+1);
  return d.toISOString().split('T')[0];
}
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#111; color:#fff; padding:12px 18px; border-radius:10px; z-index:99999; font-size:13px; font-weight:600;';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(function(){ toast.style.display='none'; }, 5000);
}
async function sendTaskEmail(type, task) {
  if (!currentUser || !currentUser.email) return;
  const key = task.id + '_' + type + '_' + task.endDate;
  if (notifiedDueTasks.indexOf(key) !== -1) return;
  try {
    const result = await supabaseClient.functions.invoke('send-task-email', {
      body: {
        to: currentUser.email,
        type: type,
        taskTitle: cleanTitle(task.text),
        startDate: task.startDate ? formatDate(task.startDate) : '',
        dueDate: task.endDate ? formatDate(task.endDate) : '',
        priority: task.priority,
        category: task.category,
        repeat: task.repeat
      }
    });
    console.log('Email sent:', type, result);
    notifiedDueTasks.push(key);
    saveLocal();
    if (type === 'created') showToast('✅ Email sent: Task Created → ' + currentUser.email);
    if (type === 'reminder') showToast('⏰ Reminder sent → ' + currentUser.email);
    if (type === 'due') showToast('🔴 Due Today email sent → ' + currentUser.email);
    if (type === 'overdue') showToast('🚨 Overdue email sent → ' + currentUser.email);
  } catch (err) {
    console.log('Email error, fallback notification', err.message);
    if (Notification && Notification.permission === 'granted') {
      new Notification('TaskLite: ' + type, { body: cleanTitle(task.text) + ' - ' + formatDate(task.endDate) });
    }
  }
}
function checkAndNotifyDueTasks() {
  if (!currentUser) return;
  tasks.forEach(function(task) {
    if (task.completed) return;
    if (isDueTomorrow(task)) { sendTaskEmail('reminder', task); }
    if (isDueToday(task)) { sendTaskEmail('due', task); }
    if (isOverdue(task)) { sendTaskEmail('overdue', task); }
    if (isOverdue(task) && task.repeat && task.repeat !== 'none') {
      const nextDate = getNextRepeatDate(task.endDate, task.repeat);
      if (nextDate) {
        const exists = tasks.some(function(t){ return t.text === task.text && t.endDate === nextDate; });
        if (!exists) {
          const newTask = {
            id: Date.now().toString() + Math.random().toString().slice(2,6),
            text: task.text, completed: false, priority: task.priority,
            startDate: task.startDate ? getNextRepeatDate(task.startDate, task.repeat) : null,
            endDate: nextDate, repeat: task.repeat, category: task.category,
            tags: task.tags, subtasks: [], createdAt: Date.now()
          };
          tasks.unshift(newTask);
          saveLocal();
          showToast('🔁 Repeated task created for ' + formatDate(nextDate));
        }
      }
    }
  });
  render();
}
window.showDashboard = function(user) {
  currentUser = user;
  const authPage = $('authPage'); const appPage = $('appPage');
  if (authPage) authPage.classList.add('hidden');
  if (appPage) appPage.classList.add('active');
  const meta = user.user_metadata || {};
  const fullName = meta.full_name || meta.name || user.email.split('@')[0];
  if ($('userEmailDisplay')) $('userEmailDisplay').textContent = user.email;
  if ($('userNameDisplay')) $('userNameDisplay').textContent = 'Hi, ' + fullName + ' 👋';
  const av = $('userAvatar');
  if (av) {
    const avatarUrl = meta.avatar_url || meta.picture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(fullName) + '&background=111827&color=fff&bold=true';
    av.src = avatarUrl; av.style.display = 'block';
  }
  if (Notification && Notification.permission !== 'granted') { Notification.requestPermission(); }
  loadFromCloud();
  setTimeout(checkAndNotifyDueTasks, 2000);
};
window.showLogin = function() {
  currentUser = null;
  const authPage = $('authPage'); const appPage = $('appPage');
  if (authPage) authPage.classList.remove('hidden');
  if (appPage) appPage.classList.remove('active');
  const loader = $('loadingOverlay'); if (loader) loader.classList.remove('active');
};
window.signIn = async function() {
  const eEl=$('email'); const pEl=$('password'); const errEl=$('authError');
  const e=eEl?eEl.value.trim():''; const p=pEl?pEl.value.trim():'';
  if (!e||!p){ if(errEl) errEl.textContent='Enter email and password'; return; }
  if(errEl) errEl.textContent='Signing in...';
  try{ const result=await supabaseClient.auth.signInWithPassword({email:e,password:p}); if(result.error){ if(errEl) errEl.textContent=result.error.message; } }catch(err){ if(errEl) errEl.textContent=err.message; }
};
window.signUp = async function() {
  const eEl=$('email'); const pEl=$('password'); const errEl=$('authError');
  const e=eEl?eEl.value.trim():''; const p=pEl?pEl.value.trim():'';
  if(p.length<6){ if(errEl) errEl.textContent='Password must be 6+ chars'; return; }
  try{ const result=await supabaseClient.auth.signUp({email:e,password:p}); if(errEl) errEl.textContent=result.error?result.error.message:'✅ Created! Now Sign In'; }catch(err){ if(errEl) errEl.textContent=err.message; }
};
window.signInWithGoogle = async function() {
  const loader=$('loadingOverlay'); if(loader) loader.classList.add('active');
  try{ const result=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}}); if(result.error){ if(loader) loader.classList.remove('active'); const errEl=$('authError'); if(errEl) errEl.textContent=result.error.message; } }catch(err){ if(loader) loader.classList.remove('active'); }
};
window.signOut = async function(){ try{ await supabaseClient.auth.signOut(); }catch(e){} window.showLogin(); };
async function checkSession() {
  if(!supabaseClient){ window.showLogin(); return; }
  try{
    const result=await supabaseClient.auth.getSession();
    if(result.data && result.data.session) window.showDashboard(result.data.session.user); else window.showLogin();
    supabaseClient.auth.onAuthStateChange(function(ev,sess){ const loader=$('loadingOverlay'); if(loader) loader.classList.remove('active'); if(sess && sess.user) window.showDashboard(sess.user); else window.showLogin(); });
  }catch(e){ window.showLogin(); }
}
async function loadFromCloud() {
  if(!currentUser||!supabaseClient) return;
  try{
    const result=await supabaseClient.from('tasks').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false});
    if(result.error){ console.log(result.error.message); return; }
    const data=result.data;
    if(data){
      tasks=data.map(function(t){ return { id:t.id, text:t.title, completed:t.is_completed||false, priority:t.priority||'medium', startDate:t.start_date||null, endDate:t.due_date||null, repeat:t.repeat||'none', category:t.category||'Personal', tags:t.tags||[], subtasks:t.subtasks||[], createdAt:new Date(t.created_at).getTime() }; });
      saveLocal(); render(); checkAndNotifyDueTasks();
    }
  }catch(e){ console.log(e); }
}
function renderCats() {
  const catList=$('categoryList'); const catInput=$('catInput');
  if(catList){
    let html='<button class="cat-btn '+(currentCat==='all'?'active':'')+'" data-cat="all">📥 All Tasks <span>'+tasks.length+'</span></button>';
    for(let i=0;i<categories.length;i++){ const c=categories[i]; html+='<button class="cat-btn '+(currentCat===c?'active':'')+'" data-cat="'+c+'">'+c+' <span>'+tasks.filter(function(t){return t.category===c;}).length+'</span></button>'; }
    catList.innerHTML=html;
  }
  if(catInput){ catInput.innerHTML=categories.map(function(c){ return '<option>'+c+'</option>'; }).join(''); }
  document.querySelectorAll('.cat-btn').forEach(function(b){ if(b.dataset.cat){ b.onclick=function(){ currentCat=b.dataset.cat; render(); if(window.innerWidth<=768){ const sb=document.querySelector('.sidebar'); if(sb) sb.classList.remove('open'); const ov=$('sidebarOverlay'); if(ov) ov.classList.remove('active'); } }; } });
}
function renderTags() {
  const tagList=$('tagList'); if(!tagList) return;
  const all=[]; tasks.forEach(function(t){ t.tags.forEach(function(tag){ if(all.indexOf(tag)===-1) all.push(tag); }); });
  tagList.innerHTML=all.map(function(t){ return '<span class="tag-pill" data-tag="'+t+'">#'+t+'</span>'; }).join('')||'<span style="font-size:12px;color:var(--text2)">No tags yet</span>';
  document.querySelectorAll('.tag-pill').forEach(function(el){ el.onclick=function(){ activeTag=activeTag===el.dataset.tag?null:el.dataset.tag; render(); }; });
}
function render() {
  const catList=$('categoryList'); if(!catList) return;
  renderCats(); renderTags();
  let filtered=[].concat(tasks);
  if(currentCat!=='all') filtered=filtered.filter(function(t){ return t.category===currentCat; });
  if(currentFilter==='active') filtered=filtered.filter(function(t){ return !t.completed; });
  if(currentFilter==='done') filtered=filtered.filter(function(t){ return t.completed; });
  if(activeTag) filtered=filtered.filter(function(t){ return t.tags.indexOf(activeTag)!==-1; });
  const searchInput=$('searchInput'); const q=searchInput?searchInput.value.toLowerCase():'';
  if(q) filtered=filtered.filter(function(t){ return t.text.toLowerCase().indexOf(q)!==-1; });
  const sortEl=$('sortInput'); const sort=sortEl?sortEl.value:'order';
  if(sort==='priority'){ const o={high:0,medium:1,low:2}; filtered.sort(function(a,b){ return o[a.priority]-o[b.priority]; }); }
  if(sort==='endDate') filtered.sort(function(a,b){ return (a.endDate||'9999').localeCompare(b.endDate||'9999'); });
  if(sort==='alpha') filtered.sort(function(a,b){ return a.text.localeCompare(b.text); });
  const taskList=$('taskList'); if(!taskList) return;
  taskList.innerHTML='';
  if(!filtered.length){ taskList.innerHTML='<li style="text-align:center;padding:40px;color:var(--text2);list-style:none">No tasks yet - use #tag!</li>'; }
  filtered.forEach(function(task){
    const overdue=isOverdue(task); const dueToday=isDueToday(task); const dueTomorrow=isDueTomorrow(task);
    const li=document.createElement('li'); li.className='task-card '+task.priority+' '+(overdue?'overdue':'');
    let dateBadges='';
    if(task.startDate){ const cls=overdue?'overdue-badge':''; dateBadges+='<span class="badge date-badge '+cls+'">📅 Start: '+formatDate(task.startDate)+'</span>'; }
    if(task.endDate){ let cls='date-badge'; if(overdue) cls+=' overdue-badge'; else if(dueToday) cls+=' due-today'; else if(dueTomorrow) cls+=' due-today'; const icon=overdue?'🔴':dueToday?'🟡':dueTomorrow?'⏰':'📅'; dateBadges+='<span class="badge '+cls+'">'+icon+' Due: '+formatDate(task.endDate)+'</span>'; }
    if(task.repeat && task.repeat!=='none'){ dateBadges+='<span class="badge repeat-badge">🔁 '+task.repeat+'</span>'; }
    let subHtml=''; if(task.subtasks&&task.subtasks.length){ for(let i=0;i<task.subtasks.length;i++){ const s=task.subtasks[i]; subHtml+='<div class="subtask-row"><input type="checkbox" '+(s.done?'checked':'')+' onchange="toggleSubtask(\''+task.id+'\','+i+')"><span>'+s.title+'</span></div>'; } }
    li.innerHTML='<div class="task-top"><input type="checkbox" '+(task.completed?'checked':'')+' onchange="toggleTask(\''+task.id+'\')"><span class="task-title '+(task.completed?'done':'')+'" onclick="openEdit(\''+task.id+'\')">'+cleanTitle(task.text)+'</span><button onclick="openEdit(\''+task.id+'\')" style="border:none;background:transparent;cursor:pointer">✏️</button><button onclick="deleteTask(\''+task.id+'\')" style="border:none;background:transparent;cursor:pointer">✕</button></div>'+subHtml+'<div class="meta"><span class="badge">'+task.priority+'</span><span class="badge">'+task.category+'</span>'+dateBadges+'</div>';
    taskList.appendChild(li);
  });
  const taskCount=$('taskCount'); if(taskCount) taskCount.textContent=filtered.length+' tasks';
}
async function addTask() {
  const input=$('taskInput'); if(!input) return; const text=input.value.trim(); if(!text) return;
  const tags=parseTags(text); const prioEl=$('priorityInput'); const startEl=$('startDateInput'); const endEl=$('endDateInput'); const repeatEl=$('repeatInput'); const catEl=$('catInput');
  const task={ id:Date.now().toString(), text:text, completed:false, priority:prioEl?prioEl.value:'medium', startDate:startEl?startEl.value:null, endDate:endEl?endEl.value:null, repeat:repeatEl?repeatEl.value:'none', category:catEl?catEl.value:'Personal', tags:tags, subtasks:[], createdAt:Date.now() };
  tasks.unshift(task); saveLocal(); render(); input.value='';
  sendTaskEmail('created', task);
  if(currentUser&&supabaseClient){
    try{ const result=await supabaseClient.from('tasks').insert({ user_id:currentUser.id, title:task.text, due_date:task.endDate, is_completed:false, priority:task.priority, category:task.category, tags:task.tags, subtasks:task.subtasks, start_date:task.startDate, repeat:task.repeat }).select(); if(result.data&&result.data[0]){ task.id=result.data[0].id; saveLocal(); } }catch(e){}
  }
}
window.toggleTask=async function(id){
  const t=tasks.find(function(x){return x.id===id;}); if(!t) return; t.completed=!t.completed; saveLocal(); render();
  if(currentUser&&supabaseClient){ try{ await supabaseClient.from('tasks').update({is_completed:t.completed}).eq('id',id); }catch(e){} }
  if(t.completed && t.repeat && t.repeat!=='none'){
    const nextDate=getNextRepeatDate(t.endDate, t.repeat);
    if(nextDate){
      const newTask={ id:Date.now().toString(), text:t.text, completed:false, priority:t.priority, startDate:t.startDate?getNextRepeatDate(t.startDate,t.repeat):null, endDate:nextDate, repeat:t.repeat, category:t.category, tags:t.tags, subtasks:[], createdAt:Date.now() };
      tasks.unshift(newTask); saveLocal(); render(); showToast('🔁 Next '+t.repeat+' created for '+formatDate(nextDate)); sendTaskEmail('created', newTask);
    }
  }
};
window.deleteTask=async function(id){ tasks=tasks.filter(function(t){return t.id!==id;}); saveLocal(); render(); if(currentUser&&supabaseClient){ try{ await supabaseClient.from('tasks').delete().eq('id',id); }catch(e){} } };
window.openEdit=function(id){ const t=tasks.find(function(x){return x.id===id;}); if(!t) return; editingId=id; tempSubtasks=JSON.parse(JSON.stringify(t.subtasks||[])); const ti=$('editTitleInput'); const di=$('editDateInput'); const pi=$('editPriorityInput'); if(ti) ti.value=t.text; if(di) di.value=t.endDate||''; if(pi) pi.value=t.priority; const em=$('editModal'); if(em) em.classList.remove('hidden'); renderEditSubtasks(); };
window.closeEdit=function(){ const em=$('editModal'); if(em) em.classList.add('hidden'); editingId=null; };
window.saveEdit=async function(){ const t=tasks.find(function(x){return x.id===editingId;}); if(!t) return; const ntEl=$('editTitleInput'); const nt=ntEl?ntEl.value.trim():''; if(!nt) return; t.text=nt; t.tags=parseTags(nt); const de=$('editDateInput'); const pe=$('editPriorityInput'); t.endDate=de?de.value||null:null; t.priority=pe?pe.value:'medium'; t.subtasks=tempSubtasks; saveLocal(); window.closeEdit(); render(); if(currentUser&&supabaseClient){ try{ await supabaseClient.from('tasks').update({title:t.text,due_date:t.endDate,priority:t.priority,subtasks:t.subtasks,tags:t.tags}).eq('id',editingId); }catch(e){} } };
window.addSubtaskInEdit=function(){ const v=$('newSubtaskInput'); if(!v) return; const val=v.value.trim(); if(!val) return; tempSubtasks.push({title:val,done:false}); v.value=''; renderEditSubtasks(); };
window.renderEditSubtasks=function(){ const es=$('editSubtasks'); if(!es) return; let html=''; for(let i=0;i<tempSubtasks.length;i++){ const s=tempSubtasks[i]; html+='<div class="subtask-row"><input type="checkbox" '+(s.done?'checked':'')+' onchange="tempSubtasks['+i+'].done=!tempSubtasks['+i+'].done; renderEditSubtasks()"><span>'+s.title+'</span><button onclick="tempSubtasks.splice('+i+',1); renderEditSubtasks()" style="margin-left:auto;border:none;background:transparent;cursor:pointer">❌</button></div>'; } es.innerHTML=html||'<div style="color:var(--text2);font-size:12px;padding:8px 0">No subtasks</div>'; };
window.toggleSubtask=async function(tid,idx){ const t=tasks.find(function(x){return x.id===tid;}); if(!t) return; t.subtasks[idx].done=!t.subtasks[idx].done; saveLocal(); render(); };
document.addEventListener('DOMContentLoaded', function(){
  const addBtn=$('addBtn'); if(addBtn) addBtn.onclick=addTask;
  const taskInput=$('taskInput'); if(taskInput) taskInput.addEventListener('keypress',function(e){ if(e.key==='Enter') addTask(); });
  const searchInput=$('searchInput'); if(searchInput) searchInput.oninput=render;
  const sortInput=$('sortInput'); if(sortInput) sortInput.onchange=render;
  document.querySelectorAll('.filter-btn').forEach(function(b){ b.onclick=function(){ document.querySelectorAll('.filter-btn').forEach(function(x){x.classList.remove('active');}); b.classList.add('active'); currentFilter=b.dataset.filter; render(); }; });
  const clearBtn=$('clearBtn'); if(clearBtn) clearBtn.onclick=function(){ tasks=tasks.filter(function(t){return !t.completed;}); saveLocal(); render(); };
  const addCatBtn=$('addCatBtn'); if(addCatBtn) addCatBtn.onclick=function(){ const inp=$('newCatInput'); const v=inp?inp.value.trim():''; if(!v||categories.indexOf(v)!==-1) return; categories.push(v); if(inp) inp.value=''; saveLocal(); render(); };
  const themeBtn=$('themeBtn'); if(themeBtn) themeBtn.onclick=function(){ document.body.classList.toggle('dark'); dark=!dark; localStorage.setItem('tasklite-dark',dark?'1':'0'); };
  const exportBtn=$('exportBtn'); if(exportBtn) exportBtn.onclick=function(){ if(!tasks.length) return alert('No tasks'); const data=tasks.map(function(t){ return {Title:cleanTitle(t.text),Status:t.completed?'Done':'Pending',Priority:t.priority,Category:t.category,Start:t.startDate||'',Due:t.endDate||'',Repeat:t.repeat||'none'}; }); const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Tasks'); XLSX.writeFile(wb,'TaskLite-'+new Date().toISOString().split('T')[0]+'.xlsx'); };
  const menuBtn=$('menuBtn'); const overlay=$('sidebarOverlay'); if(menuBtn&&overlay){ menuBtn.addEventListener('click',function(e){ e.stopPropagation(); const sb=document.querySelector('.sidebar'); if(sb) sb.classList.toggle('open'); overlay.classList.toggle('active'); }); overlay.addEventListener('click',function(){ const sb=document.querySelector('.sidebar'); if(sb) sb.classList.remove('open'); overlay.classList.remove('active'); }); }
  checkSession(); render();
  setInterval(function(){ checkAndNotifyDueTasks(); }, 60000);
});

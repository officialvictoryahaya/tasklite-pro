const $ = id => document.getElementById(id);
const taskInput = $('taskInput'), addBtn = $('addBtn'), taskList = $('taskList');
const searchInput = $('searchInput'), sortInput = $('sortInput'), priorityInput = $('priorityInput');
const startDateInput = $('startDateInput'), endDateInput = $('endDateInput'), repeatInput = $('repeatInput'), catInput = $('catInput');
const categoryList = $('categoryList'), tagList = $('tagList'), taskCount = $('taskCount');

let tasks = JSON.parse(localStorage.getItem('tasklite-pro') || '[]');
let categories = JSON.parse(localStorage.getItem('tasklite-cats') || '["Work","Personal","Shopping","Study"]');
let currentCat = 'all', currentFilter = 'all', activeTag = null, dragId = null;
let dark = localStorage.getItem('tasklite-dark') === '1';
if(dark) document.body.classList.add('dark');

function save(){ localStorage.setItem('tasklite-pro', JSON.stringify(tasks)); localStorage.setItem('tasklite-cats', JSON.stringify(categories)); }

// ===== BROWSER NOTIFICATION FEATURE =====
function requestNotifyPermission(){
  if(!('Notification' in window)) return;
  if(Notification.permission === 'default'){
    Notification.requestPermission().then(p=>{
      if(p==='granted') new Notification('TaskLite Pro','✅ Notifications enabled! You will get reminders when tasks are due.');
    });
  }
}
function showNotification(title, body){
  if(!('Notification' in window)) return;
  if(Notification.permission !== 'granted') return;
  try{ new Notification(title, { body }); }catch(e){}
}
function checkDueTasks(){
  const today = new Date().toISOString().slice(0,10);
  tasks.forEach(t=>{
    if(t.completed) return;
    if(t.endDate === today){
      showNotification('TaskLite Pro - Due Today', `"${t.text}" is due today!`);
    }
  });
}
// ===== END NOTIFICATION =====

function parseTags(text){ const m = text.match(/#[\w-]+/g) || []; return m.map(t => t.replace('#','').toLowerCase()); }

function getDateStatus(task){
    if(!task.endDate || task.completed) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const end = new Date(task.endDate); end.setHours(0,0,0,0);
    const start = task.startDate ? new Date(task.startDate) : null;
    if(start) start.setHours(0,0,0,0);
    const diff = Math.ceil((end - today) / (1000*60*60*24));
    if(today > end) return { type: 'overdue', label: `⚠ Overdue by ${Math.abs(diff)} day${Math.abs(diff)!==1?'s':''}` };
    if(diff === 0) return { type: 'due-today', label: '⏰ Due Today' };
    if(diff === 1) return { type: 'due-soon', label: 'Due Tomorrow' };
    if(diff <= 3) return { type: 'due-soon', label: `Due in ${diff} days` };
    if(start && today < start) return { type: 'upcoming', label: `Starts ${task.startDate}` };
    return { type: 'active', label: `${diff} days left` };
}
function getProgress(task){
    if(!task.startDate || !task.endDate) return null;
    const start = new Date(task.startDate).getTime();
    const end = new Date(task.endDate).getTime();
    const now = Date.now();
    if(now < start) return 0; if(now > end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
}
function addDays(dateStr, days){
    const d = new Date(dateStr); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10);
}
function addMonths(dateStr, months){
    const d = new Date(dateStr); d.setMonth(d.getMonth()+months); return d.toISOString().slice(0,10);
}
function renderCats(){
    categoryList.innerHTML = `<button class="cat-btn ${currentCat==='all'?'active':''}" data-cat="all">📥 All Tasks <span>${tasks.length}</span></button>` +
    categories.map(c => {
        const count = tasks.filter(t=>t.category===c).length;
        return `<button class="cat-btn ${currentCat===c?'active':''}" data-cat="${c}">${c} <span>${count}</span></button>`
    }).join('');
    catInput.innerHTML = categories.map(c=>`<option value="${c}">${c}</option>`).join('');
    document.querySelectorAll('.cat-btn').forEach(b=> b.onclick = ()=>{ currentCat = b.dataset.cat; requestNotifyPermission();
setTimeout(checkDueTasks, 3000);
setInterval(checkDueTasks, 60000);
render(); });
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
    if(sortInput.value==='endDate') out.sort((a,b)=> (a.endDate?new Date(a.endDate):new Date(8640000000000000)) - (b.endDate?new Date(b.endDate):new Date(8640000000000000)));
    if(sortInput.value==='priority'){ const o={high:0,medium:1,low:2}; out.sort((a,b)=> o[a.priority]-o[b.priority]); }
    if(sortInput.value==='alpha') out.sort((a,b)=> a.text.localeCompare(b.text));
    if(sortInput.value==='order') out.sort((a,b)=> a.order - b.order);
    return out;
}
function render(){
    renderCats(); renderTags();
    const filtered = getFiltered();
    taskList.innerHTML = '';
    filtered.forEach(task=>{
        const status = getDateStatus(task);
        const progress = getProgress(task);
        const isOverdue = status && status.type === 'overdue';
        const li = document.createElement('li');
        li.className = `task-card ${task.priority} ${isOverdue?'overdue-card':''}`;
        li.draggable = true; li.dataset.id = task.id;
        li.innerHTML = `
            <div class="task-top">
                <input type="checkbox" ${task.completed?'checked':''} onchange="toggleTask('${task.id}')">
                <span class="task-title ${task.completed?'done':''}">${task.text.replace(/#[\w-]+/g,'')}</span>
                <button onclick="deleteTask('${task.id}')">✕</button>
            </div>
            <div class="meta">
                <span class="badge ${task.priority}">${task.priority}</span>
                ${task.startDate?`<span class="badge start">▶ Start: ${task.startDate}</span>`:''}
                ${task.endDate?`<span class="badge end ${isOverdue?'overdue':''}">🏁 End: ${task.endDate}</span>`:''}
                ${task.repeat && task.repeat!=='none'?`<span class="badge repeat">🔁 ${task.repeat}</span>`:''}
                ${status?`<span class="badge ${isOverdue?'overdue':''}">${status.label}</span>`:''}
                <span class="badge">${task.category}</span>
                ${task.tags.map(t=>`<span class="badge">#${t}</span>`).join('')}
                <button class="badge" onclick="toggleExpand('${task.id}')">${task._expanded?'Hide':'Edit / Subtasks'}</button>
            </div>
            ${progress!==null?`<div class="progress-line"><div class="progress-fill ${isOverdue?'overdue-fill':''}" style="width:${progress}%"></div></div>`:''}
            ${task._expanded?`
                <div class="sub-area">
                    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
                        <select onchange="changePriority('${task.id}', this.value)">
                            <option value="low" ${task.priority==='low'?'selected':''}>Low</option>
                            <option value="medium" ${task.priority==='medium'?'selected':''}>Medium</option>
                            <option value="high" ${task.priority==='high'?'selected':''}>High</option>
                        </select>
                        <input type="date" value="${task.startDate||''}" onchange="changeStart('${task.id}', this.value)">
                        <input type="date" value="${task.endDate||''}" onchange="changeEnd('${task.id}', this.value)">
                        <select onchange="changeRepeat('${task.id}', this.value)">
                            <option value="none" ${task.repeat==='none'?'selected':''}>No Repeat</option>
                            <option value="daily" ${task.repeat==='daily'?'selected':''}>Daily</option>
                            <option value="weekly" ${task.repeat==='weekly'?'selected':''}>Weekly</option>
                            <option value="monthly" ${task.repeat==='monthly'?'selected':''}>Monthly</option>
                        </select>
                    </div>
                    ${task.subtasks.map(s=>`<div class="sub-row"><input type="checkbox" ${s.completed?'checked':''} onchange="toggleSub('${task.id}','${s.id}')"><span style="${s.completed?'text-decoration:line-through;opacity:.5':''}">${s.text}</span><button onclick="delSub('${task.id}','${s.id}')">✕</button></div>`).join('')}
                    <div class="sub-row"><input id="sub-${task.id}" placeholder="Add subtask..." onkeypress="if(event.key==='Enter') addSub('${task.id}')"><button onclick="addSub('${task.id}')">Add</button></div>
                </div>
            `:''}
        `;
        li.addEventListener('dragstart', e=>{ dragId = task.id; });
        li.addEventListener('dragover', e=> e.preventDefault());
        li.addEventListener('drop', e=>{
            e.preventDefault();
            const targetId = li.dataset.id;
            if(!dragId || dragId===targetId) return;
            const fromIdx = tasks.findIndex(t=>t.id===dragId);
            const toIdx = tasks.findIndex(t=>t.id===targetId);
            const [moved] = tasks.splice(fromIdx,1);
            tasks.splice(toIdx,0,moved);
            tasks.forEach((t,i)=> t.order=i);
            save(); render();
        });
        taskList.appendChild(li);
    });
    taskCount.textContent = `${filtered.length} tasks • ${tasks.filter(t=>!t.completed).length} pending`;
}
function addTask(){
    const text = taskInput.value.trim(); if(!text) return;
    tasks.push({
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
        _expanded:false
    });
    if(endDateInput.value) requestNotifyPermission();
    taskInput.value=''; startDateInput.value=''; endDateInput.value=''; repeatInput.value='none';
    save(); render();
    if(Notification.permission==='granted') showNotification('Task Added', `"${text}" added. Reminder set!`);

}
window.toggleTask = id=>{
    const t = tasks.find(x=>x.id===id);
    if(!t) return;
    const wasDone = t.completed;
    t.completed = !t.completed;
    if(!wasDone && t.completed && t.repeat && t.repeat!=='none'){
        let newStart = t.startDate, newEnd = t.endDate;
        if(t.repeat==='daily'){ if(newStart) newStart=addDays(newStart,1); if(newEnd) newEnd=addDays(newEnd,1); }
        if(t.repeat==='weekly'){ if(newStart) newStart=addDays(newStart,7); if(newEnd) newEnd=addDays(newEnd,7); }
        if(t.repeat==='monthly'){ if(newStart) newStart=addMonths(newStart,1); if(newEnd) newEnd=addMonths(newEnd,1); }
        tasks.push({
            id: Date.now().toString()+Math.random().toString(36).slice(2),
            text: t.text,
            completed:false,
            priority: t.priority,
            startDate: newStart,
            endDate: newEnd,
            repeat: t.repeat,
            category: t.category,
            tags: [...t.tags],
            subtasks: t.subtasks.map(s=>({...s, completed:false})),
            createdAt: Date.now(),
            order: tasks.length,
            _expanded:false
        });
    }
    save(); render();
}
window.deleteTask = id=>{ tasks=tasks.filter(t=>t.id!==id); save(); render(); }
window.toggleExpand = id=>{ const t=tasks.find(x=>x.id===id); if(t) t._expanded=!t._expanded; render(); }
window.addSub = id=>{
    const input = document.getElementById(`sub-${id}`); if(!input ||!input.value.trim()) return;
    const t = tasks.find(x=>x.id===id); t.subtasks.push({id:Date.now().toString(), text:input.value, completed:false});
    save(); render();
}
window.toggleSub = (taskId, subId)=>{ const t=tasks.find(x=>x.id===taskId); const s=t.subtasks.find(x=>x.id===subId); if(s) s.completed=!s.completed; save(); render(); }
window.delSub = (taskId, subId)=>{ const t=tasks.find(x=>x.id===taskId); t.subtasks=t.subtasks.filter(s=>s.id!==subId); save(); render(); }
window.changePriority = (id, val) => { const t=tasks.find(x=>x.id===id); t.priority=val; save(); render(); }
window.changeStart = (id, val) => { const t=tasks.find(x=>x.id===id); t.startDate=val; save(); render(); }
window.changeEnd = (id, val) => { const t=tasks.find(x=>x.id===id); t.endDate=val; save(); render(); }
window.changeRepeat = (id, val) => { const t=tasks.find(x=>x.id===id); t.repeat=val; save(); render(); }

addBtn.onclick = addTask;
taskInput.addEventListener('keypress', e=>{ if(e.key==='Enter') addTask(); });
searchInput.oninput = render;
sortInput.onchange = render;
document.querySelectorAll('.filter-btn').forEach(b=> b.onclick = ()=>{
    document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); currentFilter=b.dataset.filter; render();
});
$('clearBtn').onclick = ()=>{ tasks=tasks.filter(t=>!t.completed); save(); render(); }
$('addCatBtn').onclick = ()=>{
    const v=$('newCatInput').value.trim(); if(!v) return;
    if(!categories.includes(v)) categories.push(v);
    $('newCatInput').value=''; save(); render();
}
$('themeBtn').onclick = ()=>{
    document.body.classList.toggle('dark');
    dark=!dark; localStorage.setItem('tasklite-dark', dark?'1':'0');
}
window.addEventListener('keydown', e=>{
    if(e.target.tagName==='INPUT' || e.target.tagName==='SELECT') {
        if(e.key==='Escape'){ e.target.blur(); searchInput.value=''; activeTag=null; render(); }
        return;
    }
    if(e.key.toLowerCase()==='n'){ e.preventDefault(); taskInput.focus(); }
    if(e.key==='/'){ e.preventDefault(); searchInput.focus(); }
});
requestNotifyPermission();
setTimeout(checkDueTasks, 3000);
setInterval(checkDueTasks, 60000);
render();
}
$('themeBtn').onclick = ()=>{
    document.body.classList.toggle('dark');
    dark=!dark; localStorage.setItem('tasklite-dark', dark?'1':'0');
}
window.addEventListener('keydown', e=>{
    if(e.target.tagName==='INPUT' || e.target.tagName==='SELECT') {
        if(e.key==='Escape'){ e.target.blur(); searchInput.value=''; activeTag=null; render(); }
        return;
    }
    if(e.key.toLowerCase()==='n'){ e.preventDefault(); taskInput.focus(); }
    if(e.key==='/'){ e.preventDefault(); searchInput.focus(); }
});
render();

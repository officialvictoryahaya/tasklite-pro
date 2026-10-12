// TaskLite Pro - Clean Version - Empty by default, private to each device
let tasks = JSON.parse(localStorage.getItem('tasklite-tasks')) || [];
let categories = JSON.parse(localStorage.getItem('tasklite-cats')) || [];
let currentFilter = 'all';
let dragSrcIndex = null;

const taskInput = document.getElementById('taskInput');
const priorityInput = document.getElementById('priorityInput');
const taskCategory = document.getElementById('taskCategory');
const dueDateInput = document.getElementById('dueDateInput');
const addBtn = document.getElementById('addBtn');
const taskList = document.getElementById('taskList');
const searchInput = document.getElementById('searchInput');
const sortInput = document.getElementById('sortInput');
const categoryList = document.getElementById('categoryList');
const categoryInput = document.getElementById('categoryInput');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const emptyState = document.getElementById('emptyState');
const clearAllBtn = document.getElementById('clearAllBtn');

function save() {
  localStorage.setItem('tasklite-tasks', JSON.stringify(tasks));
  localStorage.setItem('tasklite-cats', JSON.stringify(categories));
}

function parseTags(text) {
  const tags = [];
  const regex = /#(\w+)/g;
  let m;
  while ((m = regex.exec(text)) !== null) tags.push(m[1].toLowerCase());
  return tags;
}

function addTask() {
  const textRaw = taskInput.value.trim();
  if (!textRaw) return;
  const tags = parseTags(textRaw);
  const cleanText = textRaw.replace(/#\w+/g, '').trim();
  tasks.unshift({
    id: Date.now(),
    text: cleanText,
    raw: textRaw,
    tags,
    priority: priorityInput.value,
    category: taskCategory.value || '',
    dueDate: dueDateInput.value || '',
    completed: false,
    createdAt: new Date().toISOString()
  });
  taskInput.value = '';
  dueDateInput.value = '';
  if(t.dueDate) requestNotifyPermission();
  save();
  render();
  if(Notification.permission==='granted') showNotification('Task Added!', `"${t.text}" added. Reminder set for ${t.dueDate || 'later'}.`);
}

function renderCategories() {
  categoryList.innerHTML = '';
  taskCategory.innerHTML = '<option value="">No Category</option>';
  categories.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'nav-btn';
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px';
    div.innerHTML = `<span>${cat}</span><span style="cursor:pointer" onclick="removeCategory('${cat}')">×</span>`;
    categoryList.appendChild(div);
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    taskCategory.appendChild(opt);
  });
}

function removeCategory(name) {
  categories = categories.filter(c => c !== name);
  tasks = tasks.map(t => t.category === name ? {...t, category: ''} : t);
  save(); renderCategories(); render();
}
window.removeCategory = removeCategory;

function getFilteredTasks() {
  let list = [...tasks];
  const q = searchInput.value.toLowerCase().trim();
  if (q) {
    list = list.filter(t => 
      t.text.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.includes(q)) ||
      t.category.toLowerCase().includes(q)
    );
  }
  if (currentFilter === 'today') {
    const today = new Date().toISOString().slice(0,10);
    list = list.filter(t => t.dueDate === today);
  } else if (currentFilter === 'upcoming') {
    const today = new Date().toISOString().slice(0,10);
    list = list.filter(t => t.dueDate && t.dueDate > today && !t.completed);
  } else if (currentFilter === 'completed') {
    list = list.filter(t => t.completed);
  }
  const sort = sortInput.value;
  if (sort === 'priority') {
    const order = {high:3, medium:2, low:1};
    list.sort((a,b) => order[b.priority] - order[a.priority]);
  } else if (sort === 'alpha') {
    list.sort((a,b) => a.text.localeCompare(b.text));
  } else if (sort === 'endDate') {
    list.sort((a,b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }
  return list;
}

function render() {
  const list = getFilteredTasks();
  taskList.innerHTML = '';
  document.getElementById('count-all').textContent = tasks.length;
  
  if (list.length === 0) {
    emptyState.classList.add('show');
  } else {
    emptyState.classList.remove('show');
  }

  list.forEach((t, index) => {
    const realIndex = tasks.findIndex(x => x.id === t.id);
    const li = document.createElement('li');
    li.className = `task-item ${t.completed ? 'completed' : ''}`;
    li.draggable = true;
    li.dataset.index = realIndex;
    li.innerHTML = `
      <div class="task-check ${t.completed ? 'done' : ''}" onclick="toggleComplete(${realIndex})">${t.completed ? '✓' : ''}</div>
      <div class="task-main">
        <div class="task-text">${escapeHtml(t.text)}</div>
        <div class="task-meta">
          <span class="badge ${t.priority}">${t.priority}</span>
          ${t.category ? `<span class="badge">${escapeHtml(t.category)}</span>` : ''}
          ${t.dueDate ? `<span class="badge">📅 ${t.dueDate}</span>` : ''}
          ${t.tags.map(tag => `<span class="badge">#${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn" onclick="deleteTask(${realIndex})">Delete</button>
      </div>
    `;
    // drag
    li.addEventListener('dragstart', (e) => { dragSrcIndex = realIndex; li.classList.add('dragging'); });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));
    li.addEventListener('dragover', (e) => e.preventDefault());
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragSrcIndex === null || dragSrcIndex === realIndex) return;
      const item = tasks.splice(dragSrcIndex,1)[0];
      tasks.splice(realIndex,0,item);
      save(); render();
    });
    taskList.appendChild(li);
  });
}

function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toggleComplete(i){ tasks[i].completed = !tasks[i].completed; save(); render(); }
window.toggleComplete = toggleComplete;
function deleteTask(i){ tasks.splice(i,1); save(); render(); }
window.deleteTask = deleteTask;

addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });
searchInput.addEventListener('input', render);
sortInput.addEventListener('change', render);
clearAllBtn.addEventListener('click', () => {
  if (!confirm('Clear all your tasks on this device?')) return;
  tasks = [];
  save(); render();
});
addCategoryBtn.addEventListener('click', () => {
  const name = categoryInput.value.trim();
  if (!name || categories.includes(name)) return;
  categories.push(name);
  categoryInput.value = '';
  save(); renderCategories();
});
document.querySelectorAll('.nav-btn[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn[data-filter]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});


// ===== BROWSER NOTIFICATION FEATURE ADDED =====
function requestNotifyPermission(){
  if(!('Notification' in window)) return;
  if(Notification.permission === 'default'){
    Notification.requestPermission().then(p=>{
      if(p==='granted') new Notification('TaskLite Pro','✅ Notifications enabled! You will be reminded when tasks are due.');
    });
  }
}
function showNotification(title, body){
  if(!('Notification' in window)) return;
  if(Notification.permission !== 'granted') return;
  new Notification(title, { body: body });
}
function checkDueTasks(){
  const today = new Date().toISOString().slice(0,10);
  tasks.forEach(t=>{
    if(t.completed) return;
    if(t.dueDate === today){
      showNotification('TaskLite Pro - Due Today', `"${t.text}" is due today!`);
    }
  });
}
requestNotifyPermission();
setTimeout(checkDueTasks, 3000);
setInterval(checkDueTasks, 60000);
// ===== END NOTIFICATION =====


// init
renderCategories();
render();

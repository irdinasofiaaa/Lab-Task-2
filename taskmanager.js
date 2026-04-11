/* =========================================
   TASKMANAGER.JS — Kanban Task Board
   Pure vanilla JS, no frameworks, no localStorage
   All cards built with DOM API (no innerHTML)
   ========================================= */

'use strict';

/* ────────────────────────────────────────
   STATE
──────────────────────────────────────── */

// In-memory task array — source of truth
let tasks = [];

// Auto-incrementing unique ID for each task
let nextId = 1;

// Tracks which column the modal is adding to, or null if editing
let activeColumn = null;
let editingTaskId = null;

/* ────────────────────────────────────────
   DOM REFERENCES — selected once at startup
──────────────────────────────────────── */

// Header
const taskCountEl      = document.getElementById('task-count');
const priorityFilterEl = document.getElementById('priority-filter');

// Column task lists
const todoList       = document.getElementById('todo-list');
const inprogressList = document.getElementById('inprogress-list');
const doneList       = document.getElementById('done-list');

// Column task-count badges
const todoCountEl       = document.getElementById('todo-count');
const inprogressCountEl = document.getElementById('inprogress-count');
const doneCountEl       = document.getElementById('done-count');

// Modal
const modalOverlay    = document.getElementById('modal-overlay');
const modalTitle      = document.getElementById('modal-heading');
const titleInput      = document.getElementById('task-title-input');
const descInput       = document.getElementById('task-desc-input');
const priorityInput   = document.getElementById('task-priority-input');
const dueInput        = document.getElementById('task-due-input');
const saveBtn         = document.getElementById('modal-save-btn');
const cancelBtn       = document.getElementById('modal-cancel-btn');
const cancelBtn2      = document.getElementById('modal-cancel-btn-2');

// Clear Done button
const clearDoneBtn = document.getElementById('clear-done-btn');

/* ────────────────────────────────────────
   HELPER — map column id → list element
──────────────────────────────────────── */

function getListElement(columnId) {
  if (columnId === 'todo')       return todoList;
  if (columnId === 'inprogress') return inprogressList;
  if (columnId === 'done')       return doneList;
  return null;
}

/* ────────────────────────────────────────
   HELPER — update all counter badges
──────────────────────────────────────── */

function updateCounters() {
  const todoTasks       = tasks.filter(function(t) { return t.column === 'todo'; });
  const inprogressTasks = tasks.filter(function(t) { return t.column === 'inprogress'; });
  const doneTasks       = tasks.filter(function(t) { return t.column === 'done'; });

  // Column-level badge counts
  todoCountEl.textContent       = todoTasks.length;
  inprogressCountEl.textContent = inprogressTasks.length;
  doneCountEl.textContent       = doneTasks.length;

  // Global header counter
  taskCountEl.textContent = tasks.length;
}

/* ────────────────────────────────────────
   TASK 2 — createTaskCard(taskObj)
   Builds a <li> using ONLY DOM API methods
   (no innerHTML, no template literals for HTML)
──────────────────────────────────────── */

function createTaskCard(taskObj) {
  // ── Wrapper <li> ──
  const li = document.createElement('li');
  li.setAttribute('data-id', taskObj.id); // (id, value)
  li.setAttribute('data-priority', taskObj.priority);
  li.classList.add('task-card');
  li.classList.add('priority-' + taskObj.priority);

  // Apply current filter immediately
  const currentFilter = priorityFilterEl.value;
  if (currentFilter !== 'all' && currentFilter !== taskObj.priority) {
    li.classList.add('is-hidden');
  }

  // ── Title span (double-click = inline edit) ──
  const titleSpan = document.createElement('span');
  titleSpan.classList.add('task-title-span');
  titleSpan.textContent = taskObj.title;
  titleSpan.setAttribute('title', 'Double-click to rename');
  li.appendChild(titleSpan);

  // ── Description ──
  if (taskObj.description) {
    const descP = document.createElement('p');
    descP.classList.add('task-desc');
    descP.textContent = taskObj.description;
    li.appendChild(descP);
  }

  // ── Meta row (badge + due date) ──
  const metaDiv = document.createElement('div');
  metaDiv.classList.add('task-meta');

  // Priority badge
  const badge = document.createElement('span');
  badge.classList.add('priority-badge');
  badge.classList.add('badge-' + taskObj.priority);

  const badgeLabels = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
  badge.textContent = badgeLabels[taskObj.priority];
  metaDiv.appendChild(badge);

  // Due date (if provided)
  if (taskObj.dueDate) {
    const dueSpan = document.createElement('span');
    dueSpan.classList.add('task-due');
    dueSpan.setAttribute('data-due', taskObj.dueDate);

    // Check if overdue
    const today  = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(taskObj.dueDate + 'T00:00:00');
    if (dueDate < today) {
      dueSpan.classList.add('overdue');
    }

    dueSpan.textContent = '📅 ' + formatDate(taskObj.dueDate);
    metaDiv.appendChild(dueSpan);
  }

  li.appendChild(metaDiv);

  // ── Action buttons ──
  const actionsDiv = document.createElement('div');
  actionsDiv.classList.add('task-actions');

  // Edit button — uses data attributes for delegation
  const editBtn = document.createElement('button');
  editBtn.classList.add('task-btn');
  editBtn.classList.add('task-btn-edit');
  editBtn.setAttribute('data-action', 'edit');
  editBtn.setAttribute('data-id', taskObj.id);
  editBtn.textContent = 'Edit';
  actionsDiv.appendChild(editBtn);

  // Delete button — uses data attributes for delegation
  const deleteBtn = document.createElement('button');
  deleteBtn.classList.add('task-btn');
  deleteBtn.classList.add('task-btn-delete');
  deleteBtn.setAttribute('data-action', 'delete');
  deleteBtn.setAttribute('data-id', taskObj.id);
  deleteBtn.textContent = 'Delete';
  actionsDiv.appendChild(deleteBtn);

  li.appendChild(actionsDiv);

  // ── Inline-edit: double-click the title span ──
  titleSpan.addEventListener('dblclick', function() {
    startInlineEdit(titleSpan, taskObj.id);
  });

  return li;
}

/* ────────────────────────────────────────
   HELPER — format ISO date for display
──────────────────────────────────────── */

function formatDate(isoDate) {
  // isoDate is "YYYY-MM-DD"
  const parts = isoDate.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[parseInt(parts[1], 10) - 1];
  return month + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
}

/* ────────────────────────────────────────
   TASK 2 — addTask(columnId, taskObj)
   Appends card to the correct column
──────────────────────────────────────── */

function addTask(columnId, taskObj) {
  // Add task to state array
  tasks.push(taskObj);

  // Build the card element and append to the column list
  const list = getListElement(columnId);
  const card = createTaskCard(taskObj);
  list.appendChild(card);

  // Refresh all counter badges
  updateCounters();
}

/* ────────────────────────────────────────
   TASK 2 — deleteTask(taskId)
   Fade-out animation, then remove from DOM & state
──────────────────────────────────────── */

function deleteTask(taskId) {
  // Find the card element in the DOM
  const card = document.querySelector('[data-id="' + taskId + '"]');
  if (!card) { return; }

  // Add CSS fade-out class — CSS handles the animation
  card.classList.add('fade-out');

  // After animation ends, remove from DOM and from tasks array
  card.addEventListener('animationend', function() {
    card.remove();
    tasks = tasks.filter(function(t) { return t.id !== taskId; });
    updateCounters();
  }, { once: true });
}

/* ────────────────────────────────────────
   TASK 2 — editTask(taskId)
   Opens the modal pre-filled with the task's data
──────────────────────────────────────── */

function editTask(taskId) {
  // Find the task object in state
  const taskObj = tasks.find(function(t) { return t.id === taskId; });
  if (!taskObj) { return; }

  // Switch modal into "edit" mode
  editingTaskId = taskId;
  activeColumn  = null;

  // Pre-fill modal fields
  modalTitle.textContent    = 'Edit Task';
  titleInput.value          = taskObj.title;
  descInput.value           = taskObj.description;
  priorityInput.value       = taskObj.priority;
  dueInput.value            = taskObj.dueDate || '';

  openModal();
}

/* ────────────────────────────────────────
   TASK 2 — updateTask(taskId, updatedData)
   Updates state and refreshes the card's DOM content
──────────────────────────────────────── */

function updateTask(taskId, updatedData) {
  // Find & update the task in the state array
  const taskIndex = tasks.findIndex(function(t) { return t.id === taskId; });
  if (taskIndex === -1) { return; }

  // Merge updated properties into the task object
  tasks[taskIndex] = Object.assign({}, tasks[taskIndex], updatedData);

  const updatedTask = tasks[taskIndex];

  // Find the existing card in DOM
  const card = document.querySelector('[data-id="' + taskId + '"]');
  if (!card) { return; }

  // Update the card: remove old and insert rebuilt card in same position
  const parent = card.parentNode;
  const newCard = createTaskCard(updatedTask);
  parent.replaceChild(newCard, card);

  // Re-apply current filter
  applyFilter(priorityFilterEl.value);
}


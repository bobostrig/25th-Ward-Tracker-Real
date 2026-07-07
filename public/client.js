// Initialize Socket.io connection
const socket = io();

// UI Elements
const currentCountEl = document.getElementById('current-count');
const percentageLabelEl = document.getElementById('percentage-label');
const progressBarFillEl = document.getElementById('progress-bar-fill');
const visitsListEl = document.getElementById('visits-list');
const visitForm = document.getElementById('visit-form');
const visitorNameInput = document.getElementById('visitor-name');
const visitNoteInput = document.getElementById('visit-note');

// Modal Elements
const visitModal = document.getElementById('visit-modal');
const openVisitBtn = document.getElementById('open-visit-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

// Theme & Reset
const themeToggleBtn = document.getElementById('theme-toggle');
const resetBtn = document.getElementById('reset-btn');

// Circular Progress Ring Math
const circle = document.querySelector('.progress-ring__circle');
const radius = circle.r.baseVal.value;
const circumference = 2 * Math.PI * radius;

circle.style.strokeDasharray = `${circumference} ${circumference}`;
circle.style.strokeDashoffset = circumference;

// Set Progress Ring Offset
function setProgress(percent) {
  const safePercent = Math.min(Math.max(percent, 0), 100);
  const offset = circumference - (safePercent / 100) * circumference;
  circle.style.strokeDashoffset = offset;
}

// Tile grid state variables
let tilesInitialized = false;
let tileElements = [];
let revealOrder = [];

// Deterministic LCG-based shuffle to keep tile reveal patterns synchronized for all users
function shuffleDeterministic(array) {
  let seed = 25; // Seeded with the 25th ward number!
  function random() {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Generate the tile grid dynamically based on the goal count
function initTiles(goal) {
  const tilesGrid = document.getElementById('tiles-grid');
  if (!tilesGrid) return;

  tilesGrid.innerHTML = '';
  tileElements = [];
  
  let cols = 10;
  let rows = Math.ceil(goal / cols);
  
  tilesGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  tilesGrid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

  for (let i = 0; i < goal; i++) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.index = i;
    tilesGrid.appendChild(tile);
    tileElements.push(tile);
  }

  revealOrder = Array.from({ length: goal }, (_, i) => i);
  shuffleDeterministic(revealOrder);
  tilesInitialized = true;
}

// Show/hide tiles based on the current count
function updateRevealGrid(count, goal) {
  if (!tilesInitialized || tileElements.length !== goal) {
    initTiles(goal);
  }
  
  for (let i = 0; i < goal; i++) {
    const tileIndex = revealOrder[i];
    const tile = tileElements[tileIndex];
    if (tile) {
      if (i < count) {
        tile.classList.add('hidden');
      } else {
        tile.classList.remove('hidden');
      }
    }
  }
}

// Format Timestamp
function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString();
}

// Update UI state with new data
function updateUI(data) {
  const count = data.count;
  const goal = data.goal || 100;
  const percent = Math.round((count / goal) * 100);

  // Update counts
  currentCountEl.textContent = count;
  percentageLabelEl.textContent = `${percent}% Completed`;
  
  // Update progress bar & ring
  setProgress(percent);
  progressBarFillEl.style.width = `${Math.min(percent, 100)}%`;

  // Update image tile reveal grid
  updateRevealGrid(count, goal);

  // Update activity list
  if (!data.history || data.history.length === 0) {
    visitsListEl.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-church opacity-30"></i>
        <p>No visits recorded yet. Be the first to add one!</p>
      </div>
    `;
  } else {
    visitsListEl.innerHTML = data.history.map(item => `
      <div class="activity-item">
        <div class="activity-meta">
          <span class="visitor-name">
            <i class="fa-solid fa-user-circle gold-text"></i> ${escapeHTML(item.name)}
          </span>
          <span class="visit-time">${formatTime(item.timestamp)}</span>
        </div>
        ${item.note ? `<p class="visit-note">"${escapeHTML(item.note)}"</p>` : ''}
      </div>
    `).join('');
  }
}

// Simple HTML escaping helper
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Socket events
socket.on('init', (data) => {
  console.log('Received initial state:', data);
  updateUI(data);
});

socket.on('update', (data) => {
  console.log('Received live update:', data);
  updateUI(data);
  // Optional audio cue / visual pop effect can go here!
});

// Modal Actions
openVisitBtn.addEventListener('click', () => {
  visitModal.classList.add('open');
  visitorNameInput.focus();
});

closeModalBtn.addEventListener('click', () => {
  visitModal.classList.remove('open');
});

// Click outside modal to close
visitModal.addEventListener('click', (e) => {
  if (e.target === visitModal) {
    visitModal.classList.remove('open');
  }
});

// Form Submission
visitForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const name = visitorNameInput.value.trim();
  const note = visitNoteInput.value.trim();

  if (name) {
    socket.emit('add_visit', { name, note });
    
    // Reset form and close modal
    visitForm.reset();
    visitModal.classList.remove('open');
  }
});

// Theme Switcher
themeToggleBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('theme-dark');
  document.body.classList.toggle('theme-light', !isDark);
  
  const icon = themeToggleBtn.querySelector('i');
  if (isDark) {
    icon.className = 'fa-solid fa-sun';
  } else {
    icon.className = 'fa-solid fa-moon';
  }
  
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
  document.body.className = 'theme-dark';
  themeToggleBtn.querySelector('i').className = 'fa-solid fa-sun';
}

// Reset trigger
resetBtn.addEventListener('click', () => {
  const password = prompt('Please enter the Admin Password to reset the tracker:');
  if (password === null) return; // User cancelled the prompt
  
  socket.emit('reset_tracker', password);
});

// Reset error handling from server
socket.on('reset_error', (message) => {
  alert(message);
});

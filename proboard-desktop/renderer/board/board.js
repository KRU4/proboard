const BOARD_TITLE = 'Pro Board';

const Renderer = (() => {
  const AVATAR_COLORS = [
    '#C8202A', '#1E4FA0', '#4CAF50', '#E67E22', '#8E44AD',
    '#2C3E50', '#16A085', '#D35400', '#2980B9', '#C0392B',
    '#27AE60', '#F39C12', '#7F8C8D', '#E74C3C', '#3498DB',
  ];

  function hashName(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  function getInitials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  function getAvatarColor(name) {
    return AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
  }

  function renderAvatar(employee, sizeClass) {
    const initials = getInitials(employee.name);
    const color = getAvatarColor(employee.name);
    const sizeCls = sizeClass === 'champion' ? 'avatar-circle-champion'
                  : sizeClass === 'minor' ? 'avatar-circle-minor'
                  : '';

    if (employee.avatar) {
      let imgCls;
      if (sizeClass === 'champion') imgCls = 'avatar-img-champion border-4 border-yellow-500';
      else if (sizeClass === 'minor') imgCls = 'w-9 h-9';
      else imgCls = 'w-16 h-16 border-3 border-gray-400';

      return `
        <img src="${employee.avatar}" alt="${employee.name}"
             class="rounded-full object-cover ${imgCls}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
        <div class="avatar-circle ${sizeCls}" style="background:${color};display:none;">${initials}</div>
      `;
    }

    return `<div class="avatar-circle ${sizeCls}" style="background:${color}">${initials}</div>`;
  }

  function renderChampion(employee) {
    return `
      <div class="champion-card champion-border champion-glow rounded-2xl p-8 flex flex-col items-center justify-center text-center"
           data-employee-name="${employee.name}"
           style="background: linear-gradient(180deg, rgba(251,191,36,0.08) 0%, #111827 100%); max-width: 320px;">
        <div class="text-6xl mb-3">👑</div>
        <div class="mb-5">${renderAvatar(employee, 'champion')}</div>
        <div class="text-yellow-400 text-sm font-semibold uppercase tracking-widest mb-2">Champion</div>
        <h1 class="text-white text-5xl font-extrabold mb-2 leading-tight">${employee.name}</h1>
        ${employee.department ? `<p class="text-gray-400 text-lg mb-4">${employee.department}</p>` : ''}
        <div class="score-badge-champion text-6xl">${employee.score.toLocaleString()}</div>
      </div>
    `;
  }

  function renderSecondary(employee) {
    const rank = employee.rank;
    const isSilver = rank === 2;
    const borderClass = isSilver ? 'silver-border' : 'bronze-border';
    const badgeClass = isSilver ? 'score-badge-silver' : 'score-badge-bronze';
    const medal = isSilver ? '🥈' : '🥉';
    const label = isSilver ? '2nd Place' : '3rd Place';
    const labelColor = isSilver ? 'text-gray-300' : 'text-orange-400';

    return `
      <div class="${borderClass} rounded-xl p-5 flex items-center gap-5"
           data-employee-name="${employee.name}"
           style="background: linear-gradient(135deg, rgba(255,255,255,0.02) 0%, #111827 100%);">
        <div class="text-3xl">${medal}</div>
        <div class="flex-shrink-0">${renderAvatar(employee, 'secondary')}</div>
        <div class="flex-1 min-w-0">
          <span class="${labelColor} text-xs font-semibold uppercase tracking-wider">${label}</span>
          <h3 class="text-white text-2xl font-bold truncate">${employee.name}</h3>
          ${employee.department ? `<p class="text-gray-500 text-sm">${employee.department}</p>` : ''}
        </div>
        <div class="${badgeClass} text-3xl">${employee.score.toLocaleString()}</div>
      </div>
    `;
  }

  function renderMinorRow(employee) {
    return `
      <div class="minor-row flex items-center gap-4 px-5 py-3 rounded-lg"
           data-employee-name="${employee.name}"
           style="background: rgba(255,255,255,0.02);">
        <span class="text-gray-500 text-lg font-bold w-10 text-center">#${employee.rank}</span>
        <div class="flex-shrink-0">${renderAvatar(employee, 'minor')}</div>
        <span class="text-white text-xl font-semibold flex-1 truncate">${employee.name}</span>
        ${employee.department ? `<span class="text-gray-500 text-sm hidden lg:inline">${employee.department}</span>` : ''}
        <div class="score-badge-minor text-lg">${employee.score.toLocaleString()}</div>
      </div>
    `;
  }

  function renderBoard(employees) {
    const championZone = document.getElementById('champion-zone');
    const secondaryZone = document.getElementById('secondary-zone');
    const minorList = document.getElementById('minor-list');

    if (!championZone || !secondaryZone || !minorList) return;

    if (employees.length === 0) {
      championZone.innerHTML = '<div class="text-gray-500 text-2xl flex items-center justify-center h-full">No data</div>';
      secondaryZone.innerHTML = '';
      minorList.innerHTML = '';
      return;
    }

    championZone.innerHTML = renderChampion(employees[0]);

    let secondaryHtml = '';
    if (employees.length >= 2) secondaryHtml += renderSecondary(employees[1]);
    if (employees.length >= 3) secondaryHtml += renderSecondary(employees[2]);
    secondaryZone.innerHTML = secondaryHtml;

    let minorHtml = '';
    for (let i = 3; i < employees.length; i++) {
      minorHtml += renderMinorRow(employees[i]);
    }
    minorList.innerHTML = minorHtml;
  }

  function updateFooter() {
    const footer = document.getElementById('footer-sync');
    if (!footer) return;
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    footer.innerHTML = `<span class="sync-dot"></span> Last synced: ${time} &bull; Live via IPC`;
    footer.setAttribute('data-timestamp', now.toISOString());
  }

  return { renderBoard, updateFooter };
})();

const Animations = (() => {
  let previousData = [];

  function detectRankChanges(prev, curr) {
    const prevMap = new Map();
    prev.forEach((e) => prevMap.set(e.name, e.rank));

    const movedUp = [];
    const movedDown = [];

    curr.forEach((e) => {
      const oldRank = prevMap.get(e.name);
      if (oldRank === undefined || e.rank < oldRank) {
        movedUp.push(e.name);
      } else if (e.rank > oldRank) {
        movedDown.push(e.name);
      }
    });

    return { movedUp, movedDown };
  }

  function applyRankAnimations(changes) {
    const cards = document.querySelectorAll('[data-employee-name]');
    cards.forEach((card) => {
      const name = card.getAttribute('data-employee-name');
      card.classList.remove('rank-up', 'rank-down');
      if (changes.movedUp.includes(name)) card.classList.add('rank-up');
      else if (changes.movedDown.includes(name)) card.classList.add('rank-down');
    });

    setTimeout(() => {
      cards.forEach((card) => card.classList.remove('rank-up', 'rank-down'));
    }, 1600);
  }

  function getPrevious() { return previousData; }
  function setPrevious(data) { previousData = [...data]; }

  return { detectRankChanges, applyRankAnimations, getPrevious, setPrevious };
})();

(function initBoard() {
  const boardTitle = document.getElementById('board-title');
  if (boardTitle) boardTitle.textContent = BOARD_TITLE;

  function updateClock() {
    const now = new Date();
    const dateEl = document.getElementById('current-date');
    const timeEl = document.getElementById('current-time');
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
    }
    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    }
  }
  updateClock();
  setInterval(updateClock, 1000);

  function renderEmployees(employees) {
    const prev = Animations.getPrevious();
    const changes = prev.length > 0
      ? Animations.detectRankChanges(prev, employees)
      : { movedUp: [], movedDown: [] };

    Renderer.renderBoard(employees);
    Renderer.updateFooter();

    if (changes.movedUp.length > 0 || changes.movedDown.length > 0) {
      Animations.applyRankAnimations(changes);
    }

    Animations.setPrevious(employees);
  }

  async function refresh() {
    try {
      const employees = await window.proboard.getEmployees();
      renderEmployees(employees);
    } catch (err) {
      console.error('Refresh failed:', err);
      const footer = document.getElementById('footer-sync');
      if (footer) {
        footer.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#EF4444;margin-right:6px;"></span> Sync failed';
      }
    }
  }

  refresh();
  window.proboard.onEmployeesUpdated((employees) => renderEmployees(employees));
})();

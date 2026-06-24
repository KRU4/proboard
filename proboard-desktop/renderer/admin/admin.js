(function initAdmin() {
  let employees = [];

  const form = document.getElementById('employee-form');
  const formTitle = document.getElementById('form-title');
  const editId = document.getElementById('edit-id');
  const tbody = document.getElementById('employee-table-body');
  const countEl = document.getElementById('employee-count');
  const excelSection = document.getElementById('excel-section');
  const noFileState = document.getElementById('no-file-state');
  const fileConnectedState = document.getElementById('file-connected-state');
  const connectedFileName = document.getElementById('connected-file-name');

  function basename(filePath) {
    return filePath.split(/[/\\]/).pop();
  }

  function showFileConnectedState(filePath) {
    noFileState.classList.add('hidden');
    fileConnectedState.classList.remove('hidden');
    excelSection.classList.remove('excel-section');
    excelSection.classList.add('excel-connected');
    connectedFileName.textContent = basename(filePath);
  }

  function showNoFileState() {
    noFileState.classList.remove('hidden');
    fileConnectedState.classList.add('hidden');
    excelSection.classList.add('excel-section');
    excelSection.classList.remove('excel-connected');
  }

  async function chooseExcelFile() {
    const result = await window.proboard.chooseExcelFile();
    if (result.success) {
      showFileConnectedState(result.filePath);
      await refreshEmployeeTable();
    }
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getInitials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  function getAvatarColor(name) {
    const colors = [
      '#C8202A', '#1E4FA0', '#4CAF50', '#E67E22', '#8E44AD',
      '#2C3E50', '#16A085', '#D35400', '#2980B9', '#C0392B',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  function renderTable() {
    if (!tbody) return;

    if (employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-600 py-12">No employees yet</td></tr>';
      countEl.textContent = '0 employees';
      return;
    }

    tbody.innerHTML = employees.map((emp, idx) => {
      const initials = getInitials(emp.name);
      const color = getAvatarColor(emp.name);
      return `
        <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition" data-emp-id="${emp.id}">
          <td class="px-6 py-3 text-gray-500 font-bold">#${idx + 1}</td>
          <td class="px-6 py-3">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style="background:${color}">${initials}</div>
              <span class="text-white font-medium">${escHtml(emp.name)}</span>
            </div>
          </td>
          <td class="px-6 py-3 text-gray-400">${escHtml(emp.department || '—')}</td>
          <td class="px-6 py-3 text-right">
            <span class="score-editable bg-blue-900/50 text-blue-300 px-3 py-1 rounded-lg font-bold"
                  data-id="${emp.id}" data-score="${emp.score}" title="Click to edit score">
              ${emp.score.toLocaleString()}
            </span>
          </td>
          <td class="px-6 py-3 text-right">
            <button data-action="edit" data-id="${emp.id}" class="text-blue-400 hover:text-blue-300 text-sm font-medium mr-3">Edit</button>
            <button data-action="delete" data-id="${emp.id}" class="text-red-400 hover:text-red-300 text-sm font-medium">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    countEl.textContent = `${employees.length} employee${employees.length !== 1 ? 's' : ''}`;
    attachTableListeners();
  }

  function attachTableListeners() {
    tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => editEmployee(parseInt(btn.dataset.id, 10)));
    });

    tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => deleteEmployee(parseInt(btn.dataset.id, 10)));
    });

    tbody.querySelectorAll('.score-editable').forEach((el) => {
      el.addEventListener('click', () => startInlineScoreEdit(el));
    });
  }

  function startInlineScoreEdit(el) {
    if (el.querySelector('input')) return;

    const id = parseInt(el.dataset.id, 10);
    const currentScore = parseInt(el.dataset.score, 10);

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = currentScore;
    input.className = 'score-input';

    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    async function save() {
      const newScore = parseInt(input.value, 10) || 0;
      if (newScore !== currentScore) {
        try {
          employees = await window.proboard.updateEmployee(id, { score: newScore });
          renderTable();
        } catch (err) {
          console.error('Score update failed:', err);
          el.textContent = currentScore.toLocaleString();
        }
      } else {
        el.textContent = currentScore.toLocaleString();
      }
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') {
        el.textContent = currentScore.toLocaleString();
      }
    });
  }

  async function refreshEmployeeTable() {
    try {
      employees = await window.proboard.getEmployees();
      renderTable();
    } catch (err) {
      console.error('Failed to load employees:', err);
      employees = [];
      renderTable();
    }
  }

  let avatarBase64 = '';
  const dropZone = document.getElementById('drop-zone');
  const avatarFile = document.getElementById('avatar-file');
  const avatarUrl = document.getElementById('emp-avatar');
  const avatarPreview = document.getElementById('avatar-preview');
  const avatarPreviewImg = document.getElementById('avatar-preview-img');
  const avatarClear = document.getElementById('avatar-clear');

  function showPreview(src) {
    avatarPreviewImg.src = src;
    avatarPreview.classList.remove('hidden');
  }

  function clearPreview() {
    avatarBase64 = '';
    avatarPreviewImg.src = '';
    avatarPreview.classList.add('hidden');
    avatarFile.value = '';
  }

  dropZone.addEventListener('click', () => avatarFile.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#3B82F6';
    dropZone.style.backgroundColor = 'rgba(59,130,246,0.05)';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '';
    dropZone.style.backgroundColor = '';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    dropZone.style.backgroundColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) processFile(file);
  });

  avatarFile.addEventListener('change', () => {
    const file = avatarFile.files[0];
    if (file) processFile(file);
  });

  function processFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      avatarBase64 = reader.result;
      avatarUrl.value = '';
      showPreview(avatarBase64);
    };
    reader.readAsDataURL(file);
  }

  avatarUrl.addEventListener('input', () => {
    if (avatarUrl.value.trim()) clearPreview();
  });

  avatarClear.addEventListener('click', () => {
    clearPreview();
    avatarUrl.value = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('emp-name').value.trim();
    const score = parseInt(document.getElementById('emp-score').value, 10) || 0;
    const department = document.getElementById('emp-dept').value.trim();
    const avatar = avatarBase64 || document.getElementById('emp-avatar').value.trim();
    const id = editId.value;

    if (!name) return;

    const body = { name, score, department, avatar };

    try {
      if (id) {
        employees = await window.proboard.updateEmployee(parseInt(id, 10), body);
      } else {
        employees = await window.proboard.addEmployee(body);
      }

      renderTable();
      form.reset();
      clearPreview();
      avatarBase64 = '';
      document.getElementById('emp-avatar').value = '';
      editId.value = '';
      formTitle.textContent = 'Add Employee';
      document.getElementById('emp-name').focus();
    } catch (err) {
      console.error('Save failed:', err);
    }
  });

  function editEmployee(id) {
    const emp = employees.find((e) => e.id === id);
    if (!emp) return;

    document.getElementById('emp-name').value = emp.name;
    document.getElementById('emp-score').value = emp.score;
    document.getElementById('emp-dept').value = emp.department || '';

    clearPreview();
    avatarBase64 = '';
    const av = emp.avatar || '';
    if (av.startsWith('data:')) {
      avatarBase64 = av;
      document.getElementById('emp-avatar').value = '';
      showPreview(av);
    } else {
      document.getElementById('emp-avatar').value = av;
    }

    editId.value = id;
    formTitle.textContent = 'Edit Employee';
    document.getElementById('emp-name').focus();
  }

  async function deleteEmployee(id) {
    try {
      employees = await window.proboard.deleteEmployee(id);
      if (editId.value === String(id)) {
        form.reset();
        editId.value = '';
        formTitle.textContent = 'Add Employee';
      }
      renderTable();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  function exportToCsv() {
    const sorted = [...employees].sort((a, b) => b.score - a.score);
    let csv = 'Name,Score,Department,Avatar\n';
    sorted.forEach((e) => {
      csv += `${e.name},${e.score},${e.department || ''},${e.avatar || ''}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'proboard_data.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById('choose-file-btn').addEventListener('click', chooseExcelFile);
  document.getElementById('change-file-btn').addEventListener('click', chooseExcelFile);
  document.getElementById('view-board-btn').addEventListener('click', () => window.proboard.focusBoard());
  document.getElementById('export-csv-btn').addEventListener('click', exportToCsv);

  window.proboard.onEmployeesUpdated((data) => {
    employees = data;
    renderTable();
  });

  (async function init() {
    const watchedFile = await window.proboard.getWatchedFile();
    if (watchedFile) showFileConnectedState(watchedFile);
    else showNoFileState();
    await refreshEmployeeTable();
  })();
})();

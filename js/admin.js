(function initAdmin() {
  let employees = [];

  const mainPanel = document.getElementById('main-panel');
  const form = document.getElementById('employee-form');
  const formTitle = document.getElementById('form-title');
  const editId = document.getElementById('edit-id');
  const tbody = document.getElementById('employee-table-body');
  const countEl = document.getElementById('employee-count');

  async function loadFromApi() {
    try {
      const res = await fetch(`${CONFIG.apiUrl}/api/employees`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      employees = await res.json();
    } catch (err) {
      console.error('Failed to load employees:', err);
      employees = [];
    }
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
        <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
          <td class="px-6 py-3 text-gray-500 font-bold">#${idx + 1}</td>
          <td class="px-6 py-3">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style="background:${color}">${initials}</div>
              <span class="text-white font-medium">${escHtml(emp.name)}</span>
            </div>
          </td>
          <td class="px-6 py-3 text-gray-400">${escHtml(emp.department || '—')}</td>
          <td class="px-6 py-3 text-right">
            <span class="bg-blue-900/50 text-blue-300 px-3 py-1 rounded-lg font-bold">${emp.score.toLocaleString()}</span>
          </td>
          <td class="px-6 py-3 text-right">
            <button onclick="editEmployee(${emp.id})" class="text-blue-400 hover:text-blue-300 text-sm font-medium mr-3">Edit</button>
            <button onclick="deleteEmployee(${emp.id})" class="text-red-400 hover:text-red-300 text-sm font-medium">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    countEl.textContent = `${employees.length} employee${employees.length !== 1 ? 's' : ''}`;
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

  // --- Image upload logic ---
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
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
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
    if (avatarUrl.value.trim()) {
      clearPreview();
    }
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
        await fetch(`${CONFIG.apiUrl}/api/employees/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch(`${CONFIG.apiUrl}/api/employees`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      await loadAndRender();
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

  async function loadAndRender() {
    await loadFromApi();
    renderTable();
  }

  window.editEmployee = function(id) {
    const emp = employees.find(e => e.id === id);
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
  };

  window.deleteEmployee = async function(id) {
    try {
      await fetch(`${CONFIG.apiUrl}/api/employees/${id}`, { method: 'DELETE' });
      if (editId.value === String(id)) {
        form.reset();
        editId.value = '';
        formTitle.textContent = 'Add Employee';
      }
      await loadAndRender();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  window.exportToCsv = function() {
    const sorted = [...employees].sort((a, b) => b.score - a.score);
    let csv = 'Name,Score,Department,Avatar\n';
    sorted.forEach(e => {
      csv += `${e.name},${e.score},${e.department || ''},${e.avatar || ''}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'proboard_data.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Import Excel/CSV ---
  let pendingImportFile = null;

  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'import-btn') {
      document.getElementById('import-file-input').click();
    }
  });

  document.addEventListener('change', async (e) => {
    if (e.target && e.target.id === 'import-file-input') {
      const file = e.target.files[0];
      if (!file) return;
      pendingImportFile = file;
      e.target.value = '';

      // اجيب أسماء الـ sheets الأول
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(`${CONFIG.apiUrl}/api/sheets`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.sheets && data.sheets.length > 1) {
          showSheetPicker(data.sheets);
        } else {
          // ورقة واحدة — اسأل clear/merge مباشرة
          showClearMergeModal(0);
        }
      } catch (err) {
        setImportStatus(`Error: ${err.message}`, 'red');
      }
    }
  });

  function setImportStatus(msg, color) {
    const el = document.getElementById('import-status');
    if (!el) return;
    el.textContent = msg;
    el.className = `text-sm text-${color}-400 ml-3`;
    if (color === 'green') setTimeout(() => { el.textContent = ''; }, 4000);
  }

  function showSheetPicker(sheets) {
    const old = document.getElementById('sheet-picker-modal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'sheet-picker-modal';
    modal.className = 'fixed inset-0 flex items-center justify-center z-50';
    modal.style.background = 'rgba(0,0,0,0.75)';

    const options = sheets.map((name, idx) =>
      `<button data-idx="${idx}"
        class="sheet-opt w-full text-left px-4 py-3 rounded-lg bg-gray-800 hover:bg-blue-700 text-white font-medium transition mb-2">
        📄 ${name}
      </button>`
    ).join('');

    modal.innerHTML = `
      <div style="background:#111827;border:1px solid #374151;border-radius:1rem;padding:1.5rem;width:100%;max-width:360px;">
        <h3 style="color:#fff;font-size:1.1rem;font-weight:700;margin-bottom:4px;">اختار الورقة</h3>
        <p style="color:#9ca3af;font-size:.85rem;margin-bottom:1rem;">الملف فيه ${sheets.length} ورقة — اختار:</p>
        ${options}
        <button id="cancel-sheet" style="width:100%;color:#6b7280;font-size:.85rem;margin-top:8px;background:none;border:none;cursor:pointer;">إلغاء</button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelectorAll('.sheet-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.remove();
        showClearMergeModal(parseInt(btn.dataset.idx, 10));
      });
    });
    document.getElementById('cancel-sheet').addEventListener('click', () => modal.remove());
  }

  function showClearMergeModal(sheetIndex) {
    const old = document.getElementById('clear-modal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'clear-modal';
    modal.className = 'fixed inset-0 flex items-center justify-center z-50';
    modal.style.background = 'rgba(0,0,0,0.75)';

    modal.innerHTML = `
      <div style="background:#111827;border:1px solid #374151;border-radius:1rem;padding:1.5rem;width:100%;max-width:360px;">
        <h3 style="color:#fff;font-size:1.1rem;font-weight:700;margin-bottom:4px;">الداتا القديمة</h3>
        <p style="color:#9ca3af;font-size:.85rem;margin-bottom:1.2rem;">عايز تعمل إيه بالموظفين الموجودين؟</p>
        <button id="btn-clear" style="width:100%;background:#b91c1c;color:#fff;padding:12px;border-radius:8px;font-weight:600;border:none;cursor:pointer;margin-bottom:10px;">
          🗑 امسح الكل وابدأ من الأول
        </button>
        <button id="btn-merge" style="width:100%;background:#1d4ed8;color:#fff;padding:12px;border-radius:8px;font-weight:600;border:none;cursor:pointer;margin-bottom:10px;">
          ➕ ضيف / حدّث على اللي موجود
        </button>
        <button id="btn-cancel-clear" style="width:100%;color:#6b7280;font-size:.85rem;background:none;border:none;cursor:pointer;">إلغاء</button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btn-clear').addEventListener('click', () => {
      modal.remove();
      doImport(sheetIndex, true);
    });
    document.getElementById('btn-merge').addEventListener('click', () => {
      modal.remove();
      doImport(sheetIndex, false);
    });
    document.getElementById('btn-cancel-clear').addEventListener('click', () => modal.remove());
  }

  async function doImport(sheetIndex, clearFirst) {
    if (!pendingImportFile) return;
    setImportStatus('جاري الرفع...', 'yellow');

    const formData = new FormData();
    formData.append('file', pendingImportFile);
    formData.append('sheetIndex', sheetIndex);
    formData.append('clearFirst', clearFirst);

    try {
      const res = await fetch(`${CONFIG.apiUrl}/api/import`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setImportStatus(`Error: ${data.error}`, 'red');
      } else {
        setImportStatus(data.message, 'green');
        await loadAndRender();
      }
    } catch (err) {
      setImportStatus('Upload failed', 'red');
    }
    pendingImportFile = null;
  }

  // Refresh button
  document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'refresh-db-btn') {
      e.target.textContent = '🔄 جاري...';
      e.target.disabled = true;
      await loadAndRender();
      e.target.textContent = '🔄 Refresh';
      e.target.disabled = false;
    }
  });

  mainPanel.classList.remove('hidden');
  loadAndRender();
})();
